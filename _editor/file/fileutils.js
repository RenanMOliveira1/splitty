var FileUtils = (function(){
    
    var self = {};
    var _editor = null;
    var _socket = null;
    var openedFiles = [];
    var currentFile = 0;
    
    const ACE_SESSION_MAP = {
        "js":"javascript",
        "hs":"haskell"
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
        bindChangeAce();
        _socket.on("openFile", (crypt_fd)=>{         
            var fd = Splitty.decrypt(crypt_fd);
            openedFiles.push(fd);
            fd.current = true;
            fd.undoStack = null;
            fd.dirty = false;
            fd.session = ace.createEditSession(fd.data,getMode(fd.extension));
            fd.session.on("change",needToSave);
            fd.pos = {};
            fd.pos.row = 1;
            fd.pos.column = 1;
            currentFile = openedFiles.length - 1;
            self.openInEditor(fd);
            Events.fire(EVENTS.FILE_OPEN,fd);
        });
    };
    
    var bindChangeAce = () =>_editor.session.on("change",needToSave);
    
    function needToSave(e){
        var fd = openedFiles[self.currentFileIndex()];
        protectedChangeAce(()=>{
            fd.pos = clone(_editor.getCursorPosition());
            fd.pos.row = fd.pos.row + 1;
            fd.pos.column = fd.pos.column + 1; 
        });
        fd.dirty = true;
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
    
    var unbindingChangeAce = () => _editor.session.removeListener('change',needToSave);
    
    var protectedChangeAce = (callback) => {
        unbindingChangeAce();
        if(typeof(callback) === "function"){
            callback();
        }
        bindChangeAce();
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
        if(!fd) return;
        openedFiles.first((e)=> e.current === true ).current = false;
        protectedChangeAce(()=> {
            fd.current = true;
            var mode = getMode(fd.extension);
            if(fd.session){
                _editor.setSession(fd.session);
            }
            _editor.getSession().setMode(mode);
            _editor.setValue(fd.data);
            if(fd.pos.row > 0)
                _editor.gotoLine(fd.pos.row,fd.pos.column);
            else
                _editor.gotoLine(1,1);
            
        });
        Events.fire(EVENTS.FILE_OPEN,fd);
    };
    
    self.openByIndex = (index) => {  
        if(openedFiles.empty() || openedFiles.length < index)return;
        if(index <= 0) currentFile = 0;
        else if(index > openedFiles.length) currentFile = openedFiles.length;
        else currentFile = index - 1;
        if(openedFiles.length >= currentFile)
            self.openInEditor(openedFiles[currentFile]);
    };
    
    self.closeByIndex = (index) => {
        var toClose = openedFiles[index-1];
        var isCurrent = toClose.current; 
        openedFiles.removeAt(index-1);
        currentFile = 0;
        if(isCurrent && openedFiles.length > 0){
            openedFiles[0].current = true;
            self.openInEditor(openedFiles[0]);
        }else if(openedFiles.empty()){
            protectedChangeAce(() => _editor.setValue(""));
        }
        Events.fire(EVENTS.FILE_CLOSE,toClose);
    };
    
    self.open = (filename) => {
        _socket.emit("openFile",Splitty.encrypt({"filename":filename}));
    };
    
    self.getOpenedFiles = () => openedFiles;
    
    self.setup = (editor,socket) =>{
        self.setEditor(editor);
        self.setSocket(socket);
        self.bind();
    };
    self.currentFileIndex = () => currentFile
    Events.when(EVENTS.FILE_SAVE,(file) => openedFiles[currentFile].data = file)
    
    return self
})()