<?php
function docman_migrate() {
  return drupal_get_form('docman_migrate_form');
}

function docman_migrate_form($form, &$form_state) {
  $form['meta'] = array(
    '#title' => 'Metadata CSV from Zoho',
    '#type' => 'managed_file',
    '#upload_validators' => array('file_validate_extensions' => array('csv')),
  );
  
  $form['ids'] = array(
    '#title' => 'File IDs from batch script',
    '#type' => 'managed_file',
    '#upload_validators' => array('file_validate_extensions' => array('csv')),
  );
  
  $form['submit'] = array(
    '#type' => 'submit',
    '#value' => 'Begin',
  );
  
  return $form;
}

function docman_migrate_form_submit($form, &$form_state) {
  $documents = array();
  
  $ids_file = file_load($form_state['values']['ids']);
  
  if (($handle = fopen($ids_file->uri, "r")) != FALSE) {
    while (($data = fgetcsv($handle, ",")) != FALSE) {
      $documents[$data[0]] = $data[1];
    }
  }
  fclose($handle);
  
  $meta_file = file_load($form_state['values']['meta']);
  
  if (($handle = fopen($meta_file->uri, "r")) != FALSE) {
    $months = array(
      'Jan' => '01', 'Feb' => '02', 'Mar' => '03', 'Apr' => '04',
      'May' => '05', 'Jun' => '06', 'Jul' => '07', 'Aug' => '08',
      'Sep' => '09', 'Oct' => '10', 'Nov' => '11', 'Dec' => '12',
    );
    
    $users = array(
      'ethio360' => 7, 'luladae' => 10, 'maeron5' => 9, 'scristina' => 5,
    );
    
    $row = 0;
    while (($data = fgetcsv($handle, ",")) != FALSE) {
      if ($row++ > 0) {
        $name = $documents[$data[13]];
        $file = file_copy((object) array(
          'uid' => $users[$data[10]],
          'uri' => $name,
          'filemime' => file_get_mimetype($name),
          'status' => 1,
          'display' => 1,
        ), file_build_uri('Documents') . '/' . end(explode('/', $name)));
		
        $date = '';
        if ($data[6] != '') {
          foreach ($months as $text => $number) {
            if (strstr($data[6], $text)) {
              $date = $number . '/';
              $date .= substr($data[6], 0, 2) . '/';
              $date .= substr($data[6], 7,4);
              break;
            }
          }
        }
        
        $docman_values['field_document']['und'][0] = (array) $file;
        $docman_values['field_recieved_on']['und'][0]['date_time'] = $date;
        $docman_values['field_policy']['und'][0]['value'] = $data[0];
        $docman_values['field_client']['und'][0]['value'] = $data[1];
        $docman_values['field_type']['und'][0]['value'] = $data[2];
        $docman_values['field_claim_number']['und'][0]['value'] = $data[3];
        $docman_values['field_notes']['und'][0]['value'] = $data[5];
        $docman_values['field_recieved_by']['und'][0]['value'] = $data[8];
        
        $docman_submission = (object) $docman_values;
        $docman = docman_save($docman_submission);
        
        $docman->uid = $users[$data[10]];
        drupal_write_record('docman_revision', $docman, 'vid');
      }
    }
  }
  fclose($handle);
  
  return 'Migration complete';
}
?>
