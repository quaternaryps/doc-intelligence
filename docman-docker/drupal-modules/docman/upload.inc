<?php
function validate_login_upload() {
  if (!user_is_logged_in()) {
    return 'You must log in before you can upload documents.';
  }

  global $user;
  if (!isset($user->roles[4])) {
    $args = get_args();
    if (count($args) == 1) {
      $docman = docman_load($args[0]);
      if (isset($docman->field_legal['und'][0]['value']) &&
        $docman->field_legal['und'][0]['value'] == 1) {
        return 'You don\'t have permission to edit legal documents.';
      }
    }
  }

  return drupal_get_form('upload_form');
}

function upload_form($form, &$form_state) {
//  drupal_add_js(drupal_get_path('module', 'docman') . '/iframeUpdateSend');

  global $doc_types;
  $db_types = db_query(
    'SELECT field_type_value FROM {field_data_field_type}')->fetchCol();
  foreach ($db_types as $type) {
    $doc_types[$type] = array(); // Gather required fields here
  }
  ksort($doc_types);
  $doc_types['Other (Create New)'] = array();

  if (count(get_args()) != 1) {
    $form['warning'] = array(
      '#markup' => 'To avoid redundancies, please use search to make sure
        that the file you\'re uploading does not already exist in the system.',
    );
  }

  field_form($form, $form_state);
  client_form($form, $form_state);
  document_form($form, $form_state);
  more_info_form($form, $form_state);

  $form['#pre_render'][] = 'pre_render';

  $form['submit'] = array(
    '#type' => 'submit',
    '#value' => 'Save',
    '#weight' => 100,
  );

  process_args_fill_form($form);

  return $form;
}

function get_args() {
  $args = explode('/', $_GET['q']);
  array_shift($args);
  return $args;
}

function process_args_fill_form(&$form) {
  $args = get_args();

  if (count($args) != 1) {
    return;
  }

  $entity = (array) docman_load($args[0]);

  foreach ($entity as $field => $data) {
    if (is_array($data) && count($data) > 0) {
      $data = $data['und'];
      $data = $data[0];

      if (isset($form[$field]['und'][0]['value'])) {
        $form[$field]['und'][0]['value']['#default_value'] = $data['value'];
      }
      else if (isset($data['value'])) {
        $form[$field]['und']['#default_value'] = $data['value'];
      }
      else if (isset($form[$field]['und'][0]['date_time'])) {
        $form[$field]['und'][0]['date_time']['#default_value'] = $data['date_time'];
      }
      else if (isset($data['fid'])) {
        $form[$field]['und'][0]['#default_value']['fid'] = $data['fid'];
        $form[$field]['und'][0]['#default_value']['display'] = TRUE;
      }
    }
  }

  $form['document']['doc_3']['recieved_by']['#default_value'] =
    isset($entity['field_recieved_by']) ?
    $entity['field_recieved_by']['und'][0]['value'] : '';

  $doc_2 = &$form['document']['doc_2'];
  if (isset($entity['field_type'])) {
    $type_value = $entity['field_type']['und'][0]['value'];
    if (isset($doc_2['type']['#options'][$type_value])) {
      $doc_2['type']['#default_value'] = $type_value;
    }
    else {
      $doc_2['type']['#default_value'] = 'Other (Create New)';
      $doc_2['other']['#type'] = 'textfield';
      $doc_2['other']['#default_value'] = $type_value;
    }
  }
}

function pre_render($form) {
  $form['client']['policy'] = $form['field_policy'];
  $form['client']['client'] = $form['field_client'];

  $form['document']['doc_1']['document'] = $form['field_document'];
  $form['document']['doc_3']['field_recieved_on'] = $form['field_recieved_on'];

  $more = &$form['more']['container'];
  $more['legal'] = $form['field_legal'];
  $more['claim']['claim_number'] = $form['field_claim_number'];
  $more['driver']['driver_name'] = $form['field_driver_name'];
  $more['driver']['drivers_license'] = $form['field_drivers_license'];
  $more['vehicle']['vin'] = $form['field_vin'];
  $more['vehicle']['year'] = $form['field_year'];
  $more['vehicle']['make'] = $form['field_make'];
  $more['vehicle']['model'] = $form['field_model'];
  $more['notes'] = $form['field_notes'];

  foreach (array_keys($form) as $field_name) {
    if (str_begins_with($field_name, 'field_') &&
      !isset($form[$field_name]['#attributes']['hidden'])) {
      unset($form[$field_name]);
    }
  }

  return $form;
}

function field_form(&$form, &$form_state) {
  $docman = (object) array();
  field_attach_form('docman', $docman, $form, $form_state);

  foreach ($form as $name => &$field) {
    if (str_begins_with($name, 'field_') &&
        $field['#attributes']['class'][0] == 'field-type-text') {
      $field['und'][0]['value']['#autocomplete_path'] = 'autocomplete/' . $name;
    }
  }

  $form['field_client']['und'][0]['value']['#attributes']['onfocusout'] = array(
    'jQuery("#edit-policy-by-client").mousedown();',
    'jQuery("#edit-field-document-und-0-upload").focus();',
  );
  $form['field_policy']['und'][0]['value']['#attributes']['onfocusout'] = array(
    'jQuery("#edit-client-by-policy").mousedown();',
  );

  $form['policy_by_client'] = array(
    '#type' => 'textfield',
    '#ajax' => array(
      'callback' => 'policy_by_client_callback',
      'wrapper' => 'policy',
      'event' => 'mousedown',
      'progress' => 'none',
    ),
    '#attributes' => array(
      'hidden' => TRUE,
    ),
  );
  $form['client_by_policy'] = array(
    '#type' => 'textfield',
    '#ajax' => array(
      'callback' => 'client_by_policy_callback',
      'wrapper' => 'client',
      'event' => 'mousedown',
      'progress' => 'none',
    ),
    '#attributes' => array(
      'hidden' => TRUE,
    ),
  );

  $form['field_policy']['#prefix'] = '<div id="policy">';
  $form['field_policy']['#suffix'] = '</div>';
  $form['field_client']['#prefix'] = '<div id="client">';
  $form['field_client']['#suffix'] = '</div>';

  if (isset($form_state['values']['field_client']['und'][0]['value']) &&
      strlen($form_state['values']['field_policy']['und'][0]['value']) == 0) {
    $client_value = $form_state['values']['field_client']['und'][0]['value'];
    if ($client_value) {
      $client_match = db_query('
        SELECT c.entity_id
        FROM {field_data_field_client} c
        WHERE c.field_client_value = :value', array(':value' => $client_value))
        ->fetchField();

      if ($client_match) {
        $policy_match = db_query('
          SELECT p.field_policy_value
          FROM {field_data_field_policy} p
          WHERE p.entity_id = :value', array(':value' => $client_match))
          ->fetchField();
        if ($policy_match) {
          $form['field_policy']['und'][0]['value']['#value'] = $policy_match;
        }
      }
    }
  }
  if (isset($form_state['values']['field_policy']['und'][0]['value']) &&
      strlen($form_state['values']['field_client']['und'][0]['value']) == 0) {
    $policy_value = $form_state['values']['field_policy']['und'][0]['value'];
    if ($policy_value) {
      $policy_match = db_query('
        SELECT p.entity_id
        FROM {field_data_field_policy} p
        WHERE p.field_policy_value = :value', array(':value' => $policy_value))
        ->fetchField();

      if ($policy_match) {
        $client_match = db_query('
          SELECT c.field_client_value
          FROM {field_data_field_client} c
          WHERE c.entity_id = :value', array(':value' => $policy_match))
          ->fetchField();

        if ($client_match) {
          $form['field_client']['und'][0]['value']['#value'] = $client_match;
        }
      }
    }
  }

  $form['field_document']['und'][0]['#process'] = array('upload_process');

  $form['field_type']['#attributes']['hidden'] = TRUE;
  $form['field_recieved_by']['#attributes']['hidden'] = TRUE;

  global $user;
  $legal = &$form['field_legal']['und'];
  if (isset($user->roles[4])) {
    $legal['#title'] = '<b>Restrict Access to Legal Department</b>';
  }
  else {
    $legal['#title'] = '';
    $legal['#attributes']['hidden'] = TRUE;
  }

  $field_recieved_on = &$form['field_recieved_on']['und'][0]['date_time'];
  $field_recieved_on['#size'] = 42;
  $field_recieved_on['#attributes']['onfocusout'] = array(
    'jQuery("#edit-field-claim-number-und-0-value").focus();',
  );

  $form['field_year']['und'][0]['value']['#size'] = 3;
}

function client_form(&$form, &$form_state) {
  $form['client'] = array(
    '#type' => 'fieldset',
    '#title' => 'Policy Info',
    '#attributes' => array('class' => array('container-inline')),
  );

}

function document_form(&$form, &$form_state) {
  $form['document'] = array(
    '#type' => 'fieldset',
    '#title' => 'Document Info',
  );

  $form['document']['doc_1'] = array(
    '#type' => 'container',
    '#attributes' => array('class' => array('container-inline')),
  );

  $form['document']['doc_2'] = $form['document']['doc_1'];
  $form['document']['doc_3'] = $form['document']['doc_1'];

  $form['document']['doc_2']['type'] = array(
    '#type' => 'select',
    '#title' => 'Document Type',
    '#required' => TRUE,
    '#options' => drupal_map_assoc(array_keys($GLOBALS['doc_types'])),
    '#attributes' => array(
      'onchange' => array(
//        'jQuery("#edit-more-info-update").click();',
        'jQuery("#edit-doc-type-update").click();',
        'jQuery("#edit-field-type-und-0-value").val(this.value);',
      )
    ),
  );
/*
  $form['more_info_update'] = array(
    '#type' => 'checkbox',
    '#attributes' => array('hidden' => TRUE),
    '#ajax' => array(
      'callback' => 'more_info_callback',
      'wrapper' => 'more_info',
      'method' => 'replace',
      'effect' => 'fade',
      'event' => 'click',
      'progress' => 'none',
    ),
  );
*/
  $form['doc_type_update'] = array(
    '#type' => 'checkbox',
    '#attributes' => array('hidden' => TRUE),
    '#ajax' => array(
      'callback' => 'doc_type_callback',
      'wrapper' => 'other',
      'method' => 'replace',
      'effect' => 'fade',
      'event' => 'click',
      'progress' => 'none',
    ),
  );

  $form['document']['doc_2']['other'] = array(
    '#required' => TRUE,
    '#title' => 'Other',
    '#size' => 22,
    '#prefix' => '<div id="other">',
    '#suffix' => '</div>',
    '#attributes' => array(
      'onchange' =>
        'jQuery("#edit-field-type-und-0-value").val(this.value);',
    ),
  );

  if (isset($form_state['values']['type']) &&
    $form_state['values']['type'] == 'Other (Create New)') {
    $form['document']['doc_2']['other']['#type'] = 'textfield';
  }

  $form['document']['doc_3']['recieved_by'] = array(
    '#type' => 'select',
    '#title' => 'Recieved By',
    '#required' => TRUE,
    '#suffix' => '&emsp;&emsp;&emsp;',
    '#options' => drupal_map_assoc(array(
      '',
      'Email',
      'Fax',
      'Hand',
      'Mail',
      'PTS',
      'User-created',
      'Web',
      "Other/Unknown",
    )),
    '#attributes' => array(
      'onchange' =>
        'jQuery("#edit-field-recieved-by-und-0-value").val(this.value);',
    ),
  );
}

function more_info_form(&$form, &$form_state) {
  $fields['legal'] = array(
    '#type' => 'container',
    '#attributes' => array('class' => array('container-inline')),
    '#suffix' => '<p>',
  );

  $fields['claim'] = array(
    '#type' => 'container',
    '#attributes' => array('class' => array('container-inline')),
    '#suffix' => '<p>',
  );

  $fields['driver'] = array(
    '#type' => 'container',
    '#attributes' => array('class' => array('container-inline')),
    '#suffix' => '<p>',
  );

  $fields['vehicle'] = array(
    '#type' => 'container',
    '#attributes' => array('class' => array('container-inline')),
    '#suffix' => '<p>',
  );

  $form['more'] = array(
    '#type' => 'fieldset',
    '#title' => 'Additional Info',
  );

  $form['more']['container'] = array(
    '#type' => 'container',
    '#prefix' => '<div id="more_info">',
    '#suffix' => '</div>',
  );


  ////// Need to find out what is required for each document type //////


  /*$form['more']['container']['required'] = array(
    '#type' => 'fieldset',
    '#title' => 'Required',
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
  );

  $form['more']['container']['optional'] = array(
    '#type' => 'fieldset',
    '#title' => 'Optional',
    '#collapsible' => TRUE,
    '#collapsed' => TRUE,
  );*/

  /*$doc_types = $GLOBALS['doc_types'];
  foreach ($doc_types[$form_state['values']['type']] as $name) {
    $fields[$name]['#required'] = TRUE;
    $form['more']['container']['required'][$name] = $fields[$name];
    $form['more']['container']['required']['#collapsed'] = FALSE;
  }*/

  foreach ($fields as $name => $field) {
    //if (!array_key_exists($name,
        //$form['more']['container']['required'])) {
      //$form['more']['container']['optional'][$name] = $field;
      $form['more']['container'][$name] = $field;
    //}
  }
}

function upload_process($element, &$form_state, $form) {
  $element = file_managed_file_process($element, $form_state, $form);

  $element['upload_button']['#attributes']['hidden'] = TRUE;
  $element['remove_button']['#value'] = 'Clear';

  $element['upload_button']['#ajax']['progress'] = 'none';
  $element['remove_button']['#ajax']['progress'] = 'none';

  $element['#description'] = NULL;

  $element['upload']['#attributes'] = array(
    'onchange' => array(
      'jQuery("#edit-field-document-und-0-upload-button").mousedown();',
      'jQuery("#edit-type").focus();',
    ),
  );

  return $element;
}

function policy_by_client_callback ($form, $form_state) {
  return $form['field_policy'];
}

function client_by_policy_callback ($form, $form_state) {
  return $form['field_client'];
}

function upload_form_validate($form, &$form_state) {
  $submission = (object) $form_state['values'];
  field_attach_form_validate('docman', $submission, $form, $form_state);
}

function upload_form_submit($form, &$form_state) {
  $original = array();

  if (process_args_load_entity($original)) {
    $original['revision'] = TRUE;
  }

  $submission = (object) array_replace($original, $form_state['values']);

  $file = file_load($form_state['values']['field_document']['und'][0]['fid']);
  if ($file->status != FILE_STATUS_PERMANENT) {
    $file->status = FILE_STATUS_PERMANENT;
    file_save($file);
  }

  field_attach_submit('docman', $submission, $form, $form_state);
  $docman = docman_save($submission);

  $form_state['redirect'] = 'docman/' . $docman->pid;
}

function process_args_load_entity(&$entity) {
  $args = get_args();

  if (count($args) != 1) {
    return FALSE;
  }

  $entity = (array) docman_load($args[0]);
  return TRUE;
}

function doc_type_callback($form, $form_state) {
  return $form['document']['doc_2']['other'];
}
?>
