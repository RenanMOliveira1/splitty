var FileUtils = (function(){
    
    var self = {};
    var _editor = null;
    var _socket = null;
    var openedFiles = [];
    var currentFile = 0;
    
    const ACE_SESSION_MAP = {
        "js":"javascript",
        "hs":"haskell",
        "txt":"text"
    };
    
    const EVENTS = {FILE_OPEN:"FILE OPEN",FILE_CLOSE:"FILE CLOSE", FILE_SAVE:"FILE SAVE", FILE_DIRTY:"FILE DIRTY"};
    Events.register(EVENTS.FILE_OPEN);
    Events.register(EVENTS.FILE_CLOSE);
    Events.register(EVENTS.FILE_SAVE);
    Events.register(EVENTS.FILE_DIRTY);
    
    
    
    self.events = EVENTS;
    
    self.setEditor = (editor) => _editor = editor;
    
    self.setSocket = (socket) => _socket = socket;
    
    self.bind = () => {
        _socket.on("openFile", (crypt_fd)=>{         
            var fd = Splitty.decrypt(crypt_fd);
            openedFiles.push(fd);
            fd.current = true;
            fd.dirty = false;
            fd.session = ace.createEditSession(fd.data,getMode(fd.extension));
            fd.pos = {};
            fd.pos.row = 1;
            fd.pos.column = 0;
            fd.undoManager = {};
            fd.undoManager.$undoStack = [];
            fd.undoManager.$redoStack = [];
            fd.undoManager.dirtyCounter  = 0;
            currentFile = openedFiles.length - 1;
            self.openInEditor(fd);
        });
    };
    self.getStoreOpenedFiles = () => {
        var opened = Splitty.prop("localFilesOpended");
        if(!opened){
            return [];
        }else{
            return JSON.parse(opened); 
        }
    };
    
    self.saveLocalOpenedFiles = (files) => {
        Splitty.prop("localFilesOpended",JSON.stringify(files));
    };
    
    
    var bindChangeAce = (session) => {
        if(typeof(session) !== "undefined"){
           session.on('change',needToSave);
           session.on('changeSelection',changeCursor);
       }else{
          _editor.session.on('change',needToSave);
          _editor.on('changeSelection',changeCursor);
       }
       
    }
    
    var bindChangeSelection = (session) => {
        _editor.on('changeSelection',changeCursor);
    }
    
    function changeCursor(){
        var fd = openedFiles[self.currentFileIndex()];
        if(fd){
            fd.pos = clone(_editor.getCursorPosition());
            fd.pos.row = fd.pos.row + 1;
            fd.pos.column = fd.pos.column + 1;
        }
    }
    
    function needToSave(e){
        var fd = openedFiles[self.currentFileIndex()];
        protectedChangeAce(()=>{
            fd.dirty = true;
        });
        fd.data = editor.getSession().doc.$lines.join("\n");
        Events.fire(EVENTS.FILE_DIRTY,fd);
    }
    
    function save(){
        if(openedFiles[currentFile] && openedFiles[currentFile].fileName){
            Events.fire(EVENTS.FILE_SAVE,editor.getSession().doc.$lines.join("\r\n"));
            _socket.emit('fileSave',Splitty.encrypt({filePath: openedFiles[currentFile].fileName, lines: editor.getSession().doc.$lines}));    
            openedFiles[currentFile].dirty = false;
            Events.fire(EVENTS.FILE_DIRTY,openedFiles[currentFile]);
        }
        
    }
    
    var unbindingChangeAce = (session) => {
       if(typeof(session) !== "undefined"){
           session.removeListener('change',needToSave);
           session.removeListener('changeSelection',changeCursor);
       }else{
        _editor.session.removeListener('change',needToSave);
       }
       _editor.removeListener('changeSelection',changeCursor); 
    }
    
    var protectedChangeAce = (callback,session) => {
        unbindingChangeAce(session);
        if(typeof(callback) === "function"){
            callback();
        }
        //bindChangeSelection(session);
        bindChangeAce(session);
    };
    
    self.save = () => save();
    
    function getMode(ext){
        if(ACE_SESSION_MAP[ext])
            return "ace/mode/" + ACE_SESSION_MAP[ext];
        return "ace/mode/" + ext;
    }
    function clone(obj){
        return JSON.parse(JSON.stringify(obj));
    }
    self.openInEditor = (fd) => {
        protectedChangeAce(()=> {
            if(!fd) return;
            var prev = openedFiles.first((e)=> e.current === true );
            prev.current = false;
            //save state change
            prev.undoManager = {};
            prev.undoManager.$undoStack = clone(_editor.session.$undoManager.$undoStack);
            prev.undoManager.$redoStack = clone(_editor.session.$undoManager.$redoStack);
            prev.undoManager.dirtyCounter = clone(_editor.session.$undoManager.dirtyCounter);
            fd.current = true;
            var mode = getMode(fd.extension);
            if(fd.session){
                _editor.setSession(fd.session);
            }
            _editor.getSession().setMode(mode);
            _editor.setValue(fd.data);
            _editor.session.$undoManager.$undoStack = clone(fd.undoManager.$undoStack);
            _editor.session.$undoManager.$redoStack = clone(fd.undoManager.$redoStack);
            _editor.session.$undoManager.dirtyCounter = clone(fd.undoManager.dirtyCounter);
            if(fd.pos.row > 0)
                _editor.gotoLine(fd.pos.row,fd.pos.column);
            else
                _editor.gotoLine(1);
             Events.fire(EVENTS.FILE_OPEN,fd);
        },fd.session);
       
        
    };
    
    self.openByIndex = (index) => {  
        if(openedFiles.empty() || openedFiles.length < index)return;
        if(index <= 0) currentFile = 0;
        else if(index > openedFiles.length) currentFile = openedFiles.length;
        else currentFile = index - 1;
        if(openedFiles.length >= currentFile){
            var fd = openedFiles[currentFile];
            self.openInEditor(fd);
        }
            
    };
    
    self.closeByIndex = (index) => {
        var toClose = openedFiles[index-1];
        var isCurrent = toClose.current; 
        openedFiles.removeAt(index-1);
        currentFile = index - 2;
        if(currentFile < 0) currentFile = 0;
        console.log("abrir " + currentFile);
        if(isCurrent && openedFiles.length > 0){
            openedFiles[currentFile].current = true;
            self.openInEditor(openedFiles[currentFile]);
        }else if(openedFiles.empty()){
            protectedChangeAce(() => _editor.setValue(""));
        }
        Events.fire(EVENTS.FILE_CLOSE,toClose);
    };
    
    self.open = (filename) => {
        _socket.emit("openFile",Splitty.encrypt({"filename":filename}));
    };
    
    self.getOpenedFiles = () => openedFiles;
    
    self.pushLocalFile = (fileName) => {
        var localFiles = self.getStoreOpenedFiles();
        if(localFiles.empty((f) => f === fileName)){
            localFiles.push(fileName);
            self.saveLocalOpenedFiles(localFiles);    
        }
    };
    self.removeLocalFile = (fileName) => {
        var localFiles = self.getStoreOpenedFiles();
        localFiles.seekAndDestroy(fileName);
        self.saveLocalOpenedFiles(localFiles);
    };
    
    self.setup = (editor,socket) =>{
        self.setEditor(editor);
        self.setSocket(socket);
        self.bind();
    };
    self.currentFileIndex = () => currentFile
    Events.when(EVENTS.FILE_SAVE,(file) => openedFiles[currentFile].data = file)
    
    Events.when(EVENTS.FILE_OPEN,(fd) => {
        self.pushLocalFile(fd.fileName);
        bindChangeSelection(fd.session);
    });
    
    Events.when(EVENTS.FILE_CLOSE,(fd) => {
        self.removeLocalFile(fd.fileName);
    });
    
    self.close = () => {
        self.closeByIndex(self.currentFileIndex()+1);
    };
    
    self.startup = () => {
        var localFiles = self.getStoreOpenedFiles();
        localFiles.each((file)=>self.open(file));
    };
    
    Splitty.register(self);
    return self
})()