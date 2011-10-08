/**
   Ginger MVC framework v0.1

   Features:
   - Modular design based on CommonJS AMD modules.
   - Builds on top of proven libraries such as jQuery, underscore.
   - Clean class hierarchies, based on javascript prototypal inheritance.
   - Property bindings.
   - Global and Local Events.
   - Undo/Redo Manager.
   - Set of views for common web "widgets".
   - Canvas View.

  Roadmap:
    - Seamless synchronization of model data between browser and server. 
  
   Dependencies:
   - jQuery
   - Underscore
   
   (c) 2011 OptimalBits with selected parts from the internet
   dual licensed as public domain or MIT.
   
   Resources:
   - http://kevinoncode.blogspot.com/2011/04/understanding-javascript-inheritance.html
   - http://javascript.crockford.com/prototypal.html
   - https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object/create
   - http://jonathanfine.wordpress.com/2008/09/21/implementing-super-in-javascript/
   - http://blog.willcannings.com/2009/03/19/key-value-coding-with-javascript/
 */

define(['/js/lib/underscore.js'], function(){

/**
  Define some useful jQuery plugins.
*/

//
// Populates the options of a select tag
//
(function( $ ){
  $.fn.comboBox = function(items, selected){
    var $comboBox = $('<select>', this)
    var options = ''
    for(var key in items){
      options += '<option '
      if (selected === key){
        options += 'selected="selected" '
      }
      options += 'value="'+key+'">'+items[key]+'</option>'
    }
    
    $comboBox.html(options)
    this.append($comboBox)
    
    return this
  };
})( jQuery );

//
// Polyfills
//

if (!Object.create) {  
  Object.create = function (o) {  
    function F() {}  
    F.prototype = o;  
    return new F();  
  }  
}

//
// Ginger Object
//
var ginger = {}

//
// Event Emitter
// (based on original work by Oliver Caldwell, olivercaldwell.co.uk)
// Dual licensed under the MIT or GPL Version 2 licenses.
// https://github.com/Wolfy87/EventEmitter
//

var EventEmitter = function() {}

EventEmitter.prototype._getListeners = function(){
  if (_.isUndefined(this._listeners)){
    this._listeners = {}
  }
  return this._listeners
}

/**
  * Assigns a listener to the specified event
  * 
  * @param {String} eventName Name of the event to assign the listener to
  * @param {Function} listener Function to be executed when the specified event is emitted
  * @returns {Object} The current instance of EventEmitter to allow chaining
  */
EventEmitter.prototype.addListener = function(eventName, listener) {
  var listeners = this._getListeners()
  if(listeners[eventName]) {
    listeners[eventName].push(listener);
  }
  else {
    listeners[eventName] = [listener];
  }
		
  // Emit the new listener event
  this.emit('newListener', eventName, listener);

  return this;
}

/**
  * Assigns a listener to the specified event (alias for addListener)
  * 
  * @param {String} eventName Name of the event to assign the listener to
  * @param {Function} listener Function to be executed when the specified event is emitted
  * @returns {Object} The current instance of EventEmitter to allow chaining
  */
EventEmitter.prototype.on = EventEmitter.prototype.addListener;
	
/**
  * Emits the specified event running all listeners associated with it
  * 
  * @param {String} eventName Name of the event to execute the listeners of
  * @param {Mixed} arguments You can pass as many arguments as you want after the event name. These will be passed to the listeners
  * @returns {Object} The current instance of EventEmitter to allow chaining
  */
EventEmitter.prototype.emit = function(eventName) {
  var listeners = this._getListeners()
  
  if(listeners[eventName]) {
    var args = Array.prototype.slice.call(arguments, 1);
    var eventListeners = listeners[eventName]
    
    // Loop over the listeners executing them
    for(var i = 0; i < eventListeners.length; i += 1) {
      eventListeners[i].apply(null, args);
    }
  }		
	
  return this
}
	
/**
  * Returns an array of listeners for the specified event name
  * 
  * @param {String} eventName Name of the event to get the listeners for
  * @returns {Array} An array of listeners for the specified event
  */
EventEmitter.prototype.listeners = function(eventName) {
  var listeners = this._getListeners()
  if(listeners[eventName]) {
			return listeners[eventName];
  }
  else {
			listeners[eventName] = [];
			return listeners[eventName];
		}
}

/**
  * Assigns a listener to the specified event removes its self after the first run
  * 
  * @param {String} eventName Name of the event to assign the listener to
  * @param {Function} listener Function to be executed when the specified event is emitted
  * @returns {Object} The current instance of EventEmitter to allow chaining
  */
EventEmitter.prototype.once = function(eventName, listener) {
  var ee = this
  
  // Create a wrapper function
  function wrapper() {
			// Call the listener and pass down the arguments
			listener.apply(null, arguments);
			
			// Remove the listener
			ee.removeListener(eventName, wrapper);
		}
		
		// Add the listener for the wrapper
		return ee.addListener(eventName, wrapper);
};
	
/**
  * Removes the specified listener
  * 
  * @param {String} eventName Name of the event to remove the listener from
  * @param {Function} listener Listener function to be removed
  * @returns {Object} The current instance of EventEmitter to allow chaining
  */
EventEmitter.prototype.removeListener = function(eventName, listener) {
  var listeners = this._getListeners()
  
  if(listeners[eventName]) {
    var index = _.indexOf(listeners[eventName], listener);
			
			if(index !== -1) {
				listeners[eventName].splice(index, 1);
			}
		}
		else {
      listeners[eventName] = [];
		}
		
		return this;
};
	
/**
  * Removes all listeners from the specified event
  * 
  * @param {String} eventName Name of the event to remove the listeners from
  * @returns {Object} The current instance of EventEmitter to allow chaining
  */
EventEmitter.prototype.removeAllListeners = function(eventName) {
  var listeners = this._getListeners()
  listeners[eventName] = [];
  return this;
}

EventEmitter.prototype.addObserver = function(eventName, listener){
// DEPRECATED: just for backwards compatibility
  this.on(eventName, listener)
}

//
// Undo Manager
//

var UndoManager = function(){
  this.undones = [];
  this.actions = [];
}

UndoManager.prototype.action = function( doFn, undoFn, callback){
  this.undones.length = 0
  this.actions.push({do:doFn, undo:undoFn, callback:callback})
    doFn(callback);
}

UndoManager.prototype.canUndo = function(){
  return this.actions.length > 0;
}
 
UndoManager.prototype.canRedo = function(){
  return this.undones.length > 0;
}
 
UndoManager.prototype.undo = function(){
  var action = this.actions.pop();
  if(action){
    action.undo(action.callback);
    this.undones.push(action);
  }
}

UndoManager.prototype.redo = function(){
  var action = this.undones.pop();
  if(action){
    action.do(action.callback),
    this.actions.push(action);
  }
}

ginger.undoMgr = new UndoManager()


//
// Global events
//

_.extend(ginger, new EventEmitter())

//
// Classes
//

function Inherit(Sub, Super){
  var newSub = Object.create(Super.prototype)
  newSub.constructor = Sub
  Sub.prototype = newSub
  Sub.superproto = Super.prototype

  Sub.prototype.super = function(klass, fn){
      if(fn) return klass.superproto[fn].apply(this, _.rest(arguments, 2))
      else klass.superproto.constructor.apply(this)
  }
} 

ginger.Declare = function( Super, Sub ){
  Inherit(Sub, Super)  
  return Sub
}

//
//  Base Class - All Ginger classes derive from this one.
//
ginger.Base = function(){
  this.bindings = {}
}

_.extend(ginger.Base.prototype, EventEmitter.prototype)

/**
  set - Sets a property and notifies any listeners attached to it.

*/
ginger.Base.prototype.set = function(key, val, args){
  if ((this[key] != val)||(_.isEqual(this[key], val)==false)){
    var oldval = this[key]
    this[key] = val
    this.emit(key, val, oldval, args)
    this.emit('change', key, val, oldval)
  }
}

/**
  get - Gets a property. Just declared for symmetry with set.
*/
ginger.Base.prototype.get = function(key){
  return this.key
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
ginger.Base.prototype.bind = function(key, object, objectKey){
  var dstKey = _.isUndefined(objectKey) ? key : objectKey

  this.unbind(key)
  
  var dstListener = _.bind(object.set, object, dstKey)
  this.on(key, dstListener)
  
  var srcListener = _.bind(this.set, this, key)
  object.on(dstKey, srcListener)
  
  this.bindings[key] = [dstListener, object, dstKey, srcListener];
  
  // sync
  this.set(key, object[dstKey])
  
  return this
}

/**
  unbind - Removes a binding.

*/
ginger.Base.prototype.unbind = function(key){
  var bindings = this.bindings
  if( (bindings!=null) && (bindings[key]) ){
    var binding = bindings[key]
    this.removeListener(key, binding[0])
    binding[1].removeListener(binding[2], binding[3])
    delete bindings[key]
  }
}

ginger.Base.prototype.init = function(err, callback){
  console.log("init method not implemented by:"+this)
}

ginger.Base.prototype.deinit = function(){
  console.log("init method not implemented by:"+this)
}

// -----------------------------------------------------------------------------------
ginger.View = ginger.Declare(ginger.Base, function(classNames){
  this.super(ginger.View)
  this.$el = $('<div>', {class:classNames})
})

ginger.View.prototype.render = function($parent){
  this.$parent = $parent
  return this.$el.appendTo($parent)
}

ginger.View.prototype.update = function(){
  // Updates this view.
  /*
    Updating can imply that if this view is composed of subviews, or of
    many DOM elements, that this DOM elements are destroyed and recreated,
    (or subvies are removed and re-rendered), but the most important thing
    is that the element that this view returned in render, is still the same after
    the update.
  */
}

ginger.View.prototype.clean = function(){
  if(this.$el) this.$el.detach()
}

ginger.View.prototype.remove = function(){
  if(this.$el) this.$el.remove()
}

ginger.View.prototype.disable = function(disable){
  console.log(this+" does not implement disable")
}

ginger.View.prototype.hide = function(duration, easing, callback) {
  this.$el.hide(arguments)
}
  
ginger.View.prototype.show = function(duration, easing, callback) {
  this.$el.show(arguments)
}
// -----------------------------------------------------------------------------------
ginger.CanvasView = ginger.Declare(ginger.View, function(classNames){
  this.super(ginger.CanvasView, 'constructor', classNames)
  this.$canvas = null
  var cv = this
  this.on('change', function(){
    cv.draw()
  })
})

ginger.CanvasView.prototype.render = function($parent){
  this.super(ginger.CanvasView, 'render', $parent)
  
  if(this.$canvas){
    this.$canvas.remove()
  }

  this.$canvas = $('<canvas>', {
    css:{width:'100%', height:'100%'}}).appendTo(this.$el)

  this.$canvas[0].width = $parent.width()
  this.$canvas[0].height = $parent.height()
  
  this.draw()
}

ginger.CanvasView.prototype.draw = function(){
  if(this.$canvas){
    return this.$canvas[0].getContext('2d')
  }else{
    return null
  }
}
// -----------------------------------------------------------------------------------
ginger.Controller = ginger.Declare(ginger.Base, function(view){
  this.super(ginger.Controller)
  this.view = view
})
// -----------------------------------------------------------------------------------
ginger.Model = ginger.Declare(ginger.Base, function(){
  this.super(ginger.Model)
  // TODO: Add methods related to synchronizing model with server, add support 
  // for caching, client side persistence, etc.
})

// -----------------------------------------------------------------------------------
//
// Views
//
// -----------------------------------------------------------------------------------
ginger.Views = {}

// -----------------------------------------------------------------------------------
ginger.Views.ComboBox = ginger.Declare(ginger.View, function(items, selected){
  this.super(ginger.Views.ComboBox)
  var view = this
    
  view.value = selected  
  view.items = items

  view.$el.comboBox(view.items, view.value).change(function(event){
    view.set('value', event.target.value)
  }).css({display:'inline'})
  
  view.on('value', function(value){
      $('select',view.$el).val(value)
  })
})
// -----------------------------------------------------------------------------------
ginger.Views.Slider = ginger.Declare(ginger.View, function(options){
  this.super(ginger.Views.Slider)
  var view = this
  
  view.value = _.isUndefined(options.value) ? 0 : options.value
  view.options = options

  var options = _.clone(view.options)
  var oldSlideFn = options.slide

  options.slide = function(event, ui){
    view.set('value', ui.value)
    if(view.options.slide) view.options.slide(event, ui)
  }
  
  options.stop = function(event, ui){
    view.set('value', ui.value)
    if(view.options.slide) view.options.slide(event, ui)
  }
  
  
  view.$el.slider(options)
    
  view.on('value', function(value){
    view.$el.slider('value', parseInt(value))
  })
})
ginger.View.prototype.disable = function(disable){
  if(disable){
    this.$el.slider('disable');
  }else{
    this.$el.slider('enable');
  }
}
// -----------------------------------------------------------------------------------
ginger.Views.ColorPicker = ginger.Declare(ginger.View, function(options){
  this.super(ginger.Views.ColorPicker)
  var view = this
  
  view.$colorPicker = $('<input>').attr({name:"color",
                                         type:"text",
                                         value:'#FFFFFFFF'})
  
  var pickerOptions = {change: function(hex, rgb) {
                        view.set('color', hex)
                      }}
                      
  if(_.isUndefined(options) == false){
    _.extend(pickerOptions, options)
  }
  
  view.$colorPicker.miniColors(pickerOptions)
  
  view.on('color', function(value){
    if(value!=view.$colorPicker.attr('value')){
      view.$colorPicker.miniColors('value', value)
    }
  })
})
ginger.Views.ColorPicker.prototype.render = function($parent){
  this.super(ginger.Views.ColorPicker, 'render')
  $parent.append(this.$colorPicker)
  return this.$el
}
ginger.View.prototype.disable = function(disable){
  this.$colorPicker.miniColors('disabled', disable);
}
// -----------------------------------------------------------------------------------
ginger.Views.TextField = ginger.Declare(ginger.View, function(){
  this.super(ginger.Views.TextField)
})
// -----------------------------------------------------------------------------------
ginger.Views.CheckBox = ginger.Declare(ginger.View, function(){
  this.super(ginger.Views.CheckBox)
})
// -----------------------------------------------------------------------------------
ginger.Views.RadioButton = ginger.Declare(ginger.View, function(){
  this.super(ginger.Views.RadioButton)
})
// -----------------------------------------------------------------------------------
ginger.Views.Label = ginger.Declare(ginger.View, function(){
  this.super(ginger.Views.Label)
  var view = this
  this.on('text', function(value){
    view.$el[0].innerHTML = value
  })
})
// -----------------------------------------------------------------------------------
ginger.Views.Button = ginger.Declare(ginger.View, function(options){
  this.super(ginger.Views.Button)
  var view = this
  _.extend(this, options)
  
  view.$el.click(function(event){
    view.emit('click', view, event) 
  })
  
  view.$el.css({
    width:'100%',
    height:'100%',
    cursor:'pointer'
  })
 
  if(this.icons){
    this.$icons = {}

    var $icon
    for(var i=0;i<this.icons.length;i++){
      $icon = $('<div>', {
        class:this.icons[i],
        css:{float:'left'}
      })
      this.$icons[this.icons[i]] = $icon
    }
    this.icon = this.icons[0]
    view.$el.append(view.$icons[this.icon])
  
    this.on('icon', function(icon, prev){
      $('.'+prev, view.$el).detach()
      view.$el.append(view.$icons[icon])
    })
  }

  if(this.label){
    var $label = $('<div>').html('<a href="#">'+this.label+'</a>').css({float:'left'})
    view.$el.append($label)
  }
})


ginger.Views.Button.prototype.enable = function(enable){
  if(enable){
    // Enable button.
  }else{
    // Disable button.
  }
}
// -----------------------------------------------------------------------------------
ginger.Views.Toolbar = ginger.Declare(ginger.View, function(items, classNames){
  this.super(ginger.Views.Toolbar)
  var view = this

  if(classNames){
    view.$el.addClass(classNames)
  }
  view.items = items
  
  var clickCallback = function(sender, event){
    view.emit('click', sender, event)
  }
  
  for(var i=0; i<items.length;i++){
    var $item_container = $('<div>').addClass('ginger_toolbaritem');
    view.$el.append($item_container)
    $item_container.append(items[i].$el)
    items[i].on('click', clickCallback)
  }
})
/*
ginger.Views.Toolbar.prototype.render = function(){
 var $el = this.super(ginger.Views.Toolbar, 'render') 
  for(var i=0; i<this.items.length;i++){
    $el.append(this.items[i].render().css({float:'left'}))
  }
  
  return $el
}
*/
// -----------------------------------------------------------------------------------
ginger.Views.ToolTip = ginger.Declare(ginger.View, function(){
  this.super(ginger.Views.ToolTip)
})
// -----------------------------------------------------------------------------------

return ginger
})
