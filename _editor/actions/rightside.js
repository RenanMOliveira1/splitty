var RightSideAction = (()=>{
    var self = {};
    
    self.execute = (value) => {
        window.parent.document.getElementById("rightSideFrame").setAttribute('src',value)
        ProportionAction.execute("50")
    }    
    self.onkeyup = (value) => {}
    self.init = () => {}
    self.getLabelAction = () => ">>>>"
    
    
    Shortcut.bindEvent("set right side",{win: "Ctrl-L", mac: "Command-L"},self)
    return self;
})();