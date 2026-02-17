<?php
function validate_login_policy($policy = '') {
  if (!user_is_logged_in()) {
    return 'You must log in before you can browse documents.';
  }

  return drupal_get_form('docman_policy_form', $policy);
}

function docman_policy_form($form, &$form_state, $policy) {
//  drupal_add_js(drupal_get_path('module', 'docman') . '/iframeUpdateSend.js');
  $form['search'] = array(
    '#type' => 'container',
    '#attributes' => array('class' => array('container-inline')),
  );

  $form['search']['field'] = array(
    '#type' => 'textfield',
    '#title' => 'Policy Number',
    '#default_value' => $policy,
    '#autocomplete_path' => 'autocomplete/field_policy',
    '#attributes' => array('class' => array('auto_submit')),
    '#size' => 20,
  );

  $policy_number = isset($form_state['values']['field']) ?
    $form_state['values']['field'] : $policy;

  $form['search']['button'] = array(
    '#type' => 'button',
    '#value' => 'Search',
    '#redirect' => $policy_number,
  );

  $form['data'] = build_view($policy_number);

  return $form;
}

function build_view($policy) {
  $ret_val = array();

  if ($policy != '') {
    $db_records = db_query('
      SELECT p.entity_id FROM {field_data_field_policy} p
      WHERE field_policy_value = :p',
      array(':p' => $policy))->fetchAll();

    $ret_val['count'] = array(
      '#type' => 'item',
      '#markup' => 'This policy has ' . count($db_records) .
        ' documents in the DMS.',
    );

    if (count($db_records) > 0) {
      global $base_root;

      foreach ($db_records as $record) {
        $entry = docman_load($record->entity_id);

        $type = $entry->field_type;
        $type = isset($type['und'][0]['value']) ?
          $type['und'][0]['value'] : '[ Uncategorized ]';

        $doc = $entry->field_document;
        $doc = $doc['und'][0];

        $grouped[$type][$entry->pid] = $doc;
      }

      ksort($grouped);

      foreach ($grouped as $type => $docs) {
        $ret_val[$type] = array(
          '#type' => 'fieldset',
          '#title' => $type . ' (' . count($docs) . ')',
          '#collapsible' => TRUE,
          '#collapsed' => TRUE,
        );

        arsort($docs);

        $ret_val[$type]['thumbs']['#markup'] =
          '<div class="scroll"><ul style="height: 600px;">';

        foreach ($docs as $pid => $doc) {
          $img = get_thumb_url($doc);
          //$dims = getimagesize($img);
          $dims = array(
            0 => 85,
            1 => 110,
          );

          $ret_val[$type]['thumbs']['#markup'] .= '
            <li>
              <a href=' . $base_root . '/docman/' . $pid . '>
                <div style="height:100%;">
                  <img src=' . $img . ' style="height:100%;
                    width:' . $dims[0] * 600 / $dims[1] .'px;">
                </div>
              </a>
            </li>';
        }

        $ret_val[$type]['thumbs']['#markup'] .= '</ul></div>';
      }
    }
  }

  return $ret_val;
}
?>
