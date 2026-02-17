Drupal.behaviors.iframeUpdateSend = {
  attach: function(context, settings) {
    var data = {
      'url':document.location.href
    }
    parent.postMessage(data, '*');
    return false;
  }
};