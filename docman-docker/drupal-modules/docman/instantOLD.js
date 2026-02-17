jQuery(document).ready(function() {
  var timer;
  
  jQuery('#edit-search').keyup(function() {
    trigger();
  });
  jQuery('#edit-search').change(function() {
    trigger();
  });
  
  function trigger() {
    clearTimeout(timer);
    timer = setTimeout("search()", 800);
  }
});

function search() {
  jQuery('#edit-hidden').val(jQuery('#edit-field').val());
  jQuery('#edit-hidden').mousedown();
}
