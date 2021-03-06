var ProportionAction = (()=>{
    var self = {};
    
    self.execute = (value) => {
        self.resize(value);
        var frame = window.parent.document.getElementById("rightSideFrame");
        var src = frame.getAttribute('src');
        var rightSideMap = RightSideAction.getUrlMap();
        rightSideMap[src] = value;
        RightSideAction.persistUrlMap(rightSideMap);
    };
    
    self.resize = (value) => {
        Splitty.prop("proportion",value);
        var frame = window.parent.document.getElementById("rightSideFrame");
        var editor = window.parent.document.getElementById("frameEditor");
        setTimeout(()=>{
            frame.setAttribute('width',value + '%');
            editor.setAttribute('width',(100 - parseInt(value)) + '%');    
        },300);
        
    };
    self.onkeyup = (value) => {};
    self.init = (txtValue) => {txtValue.value = ""};
    self.getLabelAction = () => "right side size";
    
    
    self.startup = () => {
        if(Splitty.hasProp("proportion")){
            self.execute(Splitty.prop("proportion"));
        }else if(Splitty.params().proportion){
            self.execute(Splitty.params().proportion);
        }
    };
     
    Shortcut.bindEvent("proportion",{win: "Ctrl+Shift-P", mac: "Command+Shift-P"},self);
    Splitty.register(self);
    return self;
})();
