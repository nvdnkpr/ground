/**
  Ground Web Framework (c) 2012 Optimal Bits Sweden AB
  MIT Licensed.
*/
/**
  Base Class.
  
  Most classes extends the base class in order to be observable,
  get property bindings and reference counting.
*/

/// <reference path="util.ts" />
/// <reference path="event.ts" />
/// <reference path="undo.ts" />

// TODO: we need a portable stack trace.
/*declare class Error {
  stack : string;
}
*/
// Error.prototype.stack = Error.prototype.stack || '';

module Gnd {
  
export interface IObservable 
{
  // TODO: Implement
}

export interface ISettable
{
  set(keyOrObj, val?: any, options?: {});
}

export interface IGettable
{
  get(key: string): any;
}

export class Base extends EventEmitter implements ISettable, IGettable
{
  private _refCounter: number = 1;
  private _bindings: any = {};
  private _destroyed: bool;
  private _destroyedTrace: string;
  private _undoMgr: UndoManager = new UndoManager();
  
  constructor (){
    super();
    if(!(this instanceof Base)){
      return new Base();
    }
  }
  
  /**
    set - Sets a property and notifies any listeners attached to it if changed.
  */
  set(keyOrObj, val?: any, options?: {})
  {
    var changed = false, obj;
  
    if(typeof keyOrObj == 'object'){
      options = val;
      obj = <Object>keyOrObj;
      _.each(obj, (val, key?: string) => {
        changed = this._set(key, val, options) ? true : changed;
      });
    }else{
      changed = this._set(keyOrObj, val, options)
    }
    if(changed){
      if(!obj){
        obj = {}
        obj[keyOrObj] = val;
      }
      this.emit('changed:', obj, options);
    }
    return this;
  }
  
  //
  // TODO: Accept keypath arrays besides strings.
  //
  private _set(keypath: string, val, options) {
    var 
      path = keypath.split('.'), 
      obj = this,
      len=path.length-1, 
      key = path[len];

    for(var i=0;i<len;i++){
      var t = this[path[i]];
      if (!t){
        obj = this[path[i]] = new Base();
      }else{
        obj = t;
      }
    }
    
    var isFunc = _.isFunction(obj[key]);
    var oldVal = isFunc ? obj[key].call(this) : obj[key];
  
    if((_.isEqual(oldVal, val) === false) || (options && options.force)){
      var val = this.willChange ? this.willChange(key, val) : val;
      if(isFunc){
        obj[key].call(this, val);
      }else{
        obj[key] = val
      }
      
      this.emit(keypath, val, oldVal, options)
      return true
    }else{
      return false
    }
  }
  
  willChange(key, val) {
    return val;
  }
  
  /**
    get - Gets a property. Accepts key paths for accessing deep properties.
  */
  get(key: string): any
  {
    var path = key.split('.'), result;
  
    for(var i=0, len=path.length;i<len;i++){
      result = this[path[0]];
      
      result = _.isFunction(result) ? result.call(this) : result;
      
      if(!_.isObject(result)) break;
    }
    return result;
  }
  
  
  /**
   * bind - Creates a binding between two keys.
   * 
   * @param {String} key Key to bind in the source object
   * @param {Object} object Target object to bind this objects key
   * @param [{String}] objectKey The key in the destination object to bind the key
   *
   * Note: If the keys have different values when binding, the caller will get
   * the value of the target object key
   */
  bind(key, object, objectKey){
    var dstKey = objectKey || key

    this.unbind(key)
  
    var dstListener = _.bind(object.set, object, dstKey)
    this.on(key, dstListener)
  
    var srcListener = _.bind(this.set, this, key)
    object.on(dstKey, srcListener)
  
    this._bindings[key] = [dstListener, object, dstKey, srcListener];
  
    // sync
    this.set(key, object[dstKey])
  
    return this
  }
  /**
    unbind - Removes a binding.

  */
  unbind(key)
  {
    var bindings = this._bindings
    if( (bindings!=null) && (bindings[key]) ){
      var binding = bindings[key]
      this.removeListener(key, binding[0])
      binding[1].removeListener(binding[2], binding[3])
      delete bindings[key]
    }
  }
  
  /**
    Begins an undo operation over setting a given key to a value.
  */
  beginUndoSet(key)
  {
    var base = this
    ;(function(value){
      this.undoMgr.beginUndo(function(){
        base.set(key, value)
    }, name)}(this[key]))
  }
  /**
    Ends an undo operation over setting a given key to a value.
  */
  endUndoSet(key)
  {
    var base = this
    ;(function(value){
      this.undoMgr.endUndo(function(){
        base.set(key, value)
    })}(this[key]))
  }
  
  /**
    Sets a key value while registering it as an undo operation
  */
  undoSet(key, value, fn)
  {
    this.beginUndoSet(key)
    this.set(key, value)
    this.endUndoSet(key)
  }
  
  destroy()
  {
    this.emit('destroy:');
    this._destroyed = true;
    this._destroyedTrace = "";//new Error().stack;
    this.off();
    
    // TODO: nullify this object.
  }
  
  retain(): Base
  {
    if(this._destroyed){
      throw new Error("Cannot retain destroyed object");
    }
    this._refCounter++;
    return this;
  }
  
  release(): Base
  {
    this._refCounter--;
    if(this._refCounter===0){
      this.destroy();
    }else if(this._refCounter < 0){
      var msg;
      if(this._destroyed){
        msg = "Object has already been released";
        if(this._destroyedTrace){
          msg += '\n'+this._destroyedTrace;
        }
        throw new Error(msg);
      }else{
        msg = "Invalid reference count!";
      }
      throw new Error(msg);
    }
    return this;
  }
  
  autorelease(): Base
  {
    Util.nextTick(()=>{
      this.release();
    });
    return this;
  }
  
  isDestroyed(): bool
  {
    return this._refCounter === 0;
  }
}

}
