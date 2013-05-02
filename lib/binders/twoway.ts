/**
  Ground Web Framework (c) 2011-2013 Optimal Bits Sweden AB
  MIT Licensed.
*/

/// <reference path="../viewmodel.ts" />

// TODO: Allow pipelining formatters.

module Gnd {

//
// Syntax: "attr0: keyPath; attr1: keyPath "
//
// Syntax: "attr0: keyPath | formatter0; attr1: keyPath | formatter1"
//
export class TwoWayBinder implements Binder
{
  // [ [model, onKeypathFn, eventListener], [...], ...] 
  private bindings: any[][] = [];
  private el: Element;
  private attrBindings: {[index: string]: string[];} = {};
  private attrFormatters: {[index: string]: (input: string)=>string;} = {};
    
  private static re = /((\s*(\w+)\s*\:\s*((\w+\.*)+)\s*(\|\s*(\w+)\s*)?);?)/gi;
  
  private parse(value: string, 
                formatters: {[index: string]: (input: string)=>string;})
  {
    var match, formatter;
    while(match = TwoWayBinder.re.exec(value)){
      var attr = match[3];
      this.attrBindings[attr] = makeKeypathArray(match[4]);
      formatter = formatters[match[7]];
      if(formatter){
        this.attrFormatters[attr] = formatter;
      }
    }
  }
  
  private createBinding(attr: string, el: Element, viewModel: ViewModel)
  {
    var 
      attrBinding = this.attrBindings[attr],
      attrFormatter = this.attrFormatters[attr],
      obj = viewModel.resolveContext(([attrBinding[0]]));
    
    if(obj instanceof Base){
      //
      // TODO: This join('.') will disapear when we have
      // keypath support in Base as an array.
      //
      var 
        keypath = _.rest(attrBinding).join('.'),
        modelListener,
        elemListener = null;
        
      var format = () => {
        return attrFormatter ? 
          attrFormatter.call(obj, obj.get(keypath)) : obj.get(keypath);
      }
        
      if(attr === 'text'){
        setText(el, format());
        modelListener = () => setText(el, format());
      }else{
        setAttr(el, attr, format());
        modelListener = () => setAttr(el, attr, format());
        elemListener = (value) => obj.set(keypath, getAttr(el, attr));
      }
      obj.retain();
      obj.on(keypath, modelListener);
      $(el).on('change', elemListener);
        
      this.bindings.push([obj, keypath, modelListener, elemListener]);
    }else{
      console.log("Warning: not found a valid model: "+attrBinding[0]);
    }
  }
  
  bind(el: Element, value: string, viewModel: ViewModel)
  {
    this.parse(value, viewModel.formatters);
        
    this.el = el;
    
    for(var attr in this.attrBindings){
      this.createBinding(attr, el, viewModel);
    }
  }

  unbind(){
    _.each(this.bindings, (item) => {
      item[0].off(item[1], item[2]);
      item[0].release();
      item[3] && $(this.el).off('change', item[3]);
    });
  }
}

function setText(el: Element, value){
  if(isElement(value)){
    el.parentNode.replaceChild(value, el);
  }else{
    $(el).html(value);
  }
}

}