<?php
function validate_login_browse() {
  if (!user_is_logged_in()) {
    return 'You must log in before you can search documents.';
  }

  //return array(
  //  '#markup' => '
  //    <p>Search functionality is temporarily disabled for maintenance.</p>
  //    <p>In the meantime, please use <a href="/policy">Policy View</a> to find documents.</p>
  //    <p>-Beruke</p>
  //  '
  //);
  return drupal_get_form('docman_search_form');
//   return drupal_get_form('docman_search_form_OLD');
}

function docman_search_form($form, &$form_state) {
  drupal_add_js(drupal_get_path('module', 'docman') . '/instant.js');
  $search_terms = isset($_GET['search']) ? $_GET['search'] : '';

  return array(
    'search' => array(
      '#type' => 'container',
      '#attributes' => array(
        'class' => array(
          'container-inline'
        )
      ),
      'field' => array(
        '#type' => 'textfield',
        '#default_value' => $search_terms,
      ),
      'button' => array(
        '#type' => 'submit',
        '#value' => 'Search',
      ),
    ),
    'table' => build_table($search_terms, $form),
  );
}

function docman_search_form_submit($form, &$form_state) {
  $form_state['redirect'] = array(
    'browse',
    array(
      'query' => array(
        'search' => $form_state['values']['field'],
        'sort' => isset($_GET['sort']) ? $_GET['sort'] : array(),
        'order' => isset($_GET['order']) ? $_GET['order'] : array(),
      ),
    )
  );
}


function build_table($search_terms) {
  global $base_root;
  global $user;

  $search_terms = explode(' ', $search_terms);
  foreach ($search_terms as $index => $term) {
    if (strlen($term) == 0) {
      unset($search_terms[$index]);
    }
  }
  $skip_filter = count($search_terms) == 0;

  $skip_headers = array('Document', 'Recieved On');
  if ($user->uid == 1) {
    unset($skip_headers[1]);
  }
  $fields = field_info_instances('docman', 'docman');
  $header = array();
  unset($fields['field_legal']);
  foreach ($fields as $field) {
    $label = $field['label'];
    $header[$label]['data'] = $label;
    if ($user->uid == 1 && $label == 'Recieved On') {
      $header[$label]['type'] = 'field';
      $header[$label]['specifier'] = array(
        'field' => $field['field_name'],
        'column' => 'date_time',
      );
    } else if (!in_array($label, $skip_headers)) {
      $header[$label]['type'] = 'field';
      $header[$label]['specifier'] = array(
        'field' => $field['field_name'],
        'column' => 'value',
      );
    }
  }

  $query = new EntityFieldQuery();
  $query->entityCondition('entity_type', 'docman');
  if (strpos(request_uri(), 'sort') === FALSE) {
    $query->fieldOrderBy('field_document', 'fid', 'DESC');
  }
  $query->tableSort($header);
  unset($query->{'order'}[1]);
  unset($query->{'fields'}[1]);
  $query_results = $query->execute();
  $entities = docman_load_multiple(array_keys($query_results['docman']));
//  $entities = entity_load('docman', array_keys($query_results['docman']));

  $add['actions']['data'] = 'Actions';
  $add['owner']['data'] = 'Last Touched';
  $header = $add + $header;

  $skip_fields = array('vid', 'timestamp', 'pid',
      'created', 'changed', 'rdf_mapping', 'field_legal');

  $show_legal = isset($user->roles[4]);

  $rows = array();
  foreach ($entities as $entity) {
    if ($show_legal || !$entity->{'field_legal'}['und'][0]['value']) {
      $details_url = $base_root . '/docman/' . $entity->pid;
      $edit_url = $base_root . '/upload/' . $entity->pid;
      $rows[$entity->pid]['data'][] = '<a href=' . $details_url . '>Details</a>
        <br /><a href=' . $edit_url . '>Edit</a>';

      $row_text = '';
      foreach ($entity as $field => $cell) {
        if (!in_array($field, $skip_fields)) {
          if (empty($cell)) {
            $rows[$entity->pid]['data'][] = '';
          }
          else {
            $parent = $cell['und'];
            $parent = $parent[0];
            $value = '';

            if (is_string($cell)) {
              $value = get_username($cell);
            }
            else if (isset($parent['filename'])) {
              $value = $parent['filename'];
              $text = $value;
              $url = file_create_url($parent['uri']);
              $value = '<a href=' . $url . '>' . $text . '</a>';
            }
            else if ($field == 'field_policy') {
              $value = '<a href=' . $base_root . '/policy/' .
                $parent['value'] . '>' . $parent['value'] . '</a>';
            }
            else {
              $value = isset($parent['date_time']) ?
                $parent['date_time'] : $parent['value'];
            }

            $rows[$entity->pid]['data'][$field] =
              '<div class="row">' . $value . '</div>';

            $row_text .= $value . ' ';
          }
        }
      }
    }

    foreach ($search_terms as $term) {
      if (!stristr($row_text, str_replace('+', ' ', $term))) {
        unset($rows[$entity->pid]);
        break;
      }
    }
  }

  $count = count($rows);
  $count_string = $count . ' document' . ($count > 1 ? 's ' : ' ') . 'found ';
  if ($skip_filter) {
    $count_string .= 'total in the DMS.';
  }
  else {
    $count_string .= 'containing the term' .
      (count($search_terms) > 1 ? 's ' : ' ');
    foreach ($search_terms as $term) {
      $count_string .= '"<b>' . str_replace('+', ' ', $term) . '</b>", ';
    }
    $count_string = substr($count_string, 0, -2) . '.';
  }

  $per_page = 10;
  $current_page = pager_default_initialize(count($rows), $per_page);
  $chunks = array_chunk($rows, $per_page, TRUE);

  return array(
    'count' => array(
      '#type' => 'item',
      '#disabled' => TRUE,
      '#markup' => $count_string,
    ),
    'table' => array(
      '#theme' => 'table',
      '#header' => $header,
      '#rows' => count($rows) > 0 ? $chunks[$current_page] : $rows,
    ),
    'pager' => array(
      '#theme' => 'pager',
    ),
  );
}

function docman_search_form_OLD($form, &$form_state) {
  drupal_add_js(drupal_get_path('module', 'docman') . '/instantOLD.js');
  //drupal_add_js(drupal_get_path('module', 'docman') . '/iframeUpdateSend.js');

  $form['search'] = array(
    '#type' => 'container',
    '#attributes' => array('class' => array('container-inline')),
    'field' => array(
      '#type' => 'textfield',
    ),
    'hidden' => array(
      '#type' => 'textfield',
      '#ajax' => array(
        'callback' => 'search_callback_OLD',
        'wrapper' => 'table',
        'event' => 'mousedown',
      ),
      '#attributes' => array(
        'hidden' => TRUE,
      ),
    ),
  );

  $search_terms = isset($form_state['values']['hidden']) ?
  $form_state['values']['hidden'] : '';

  $form['table'] = build_table($search_terms);

  return $form;
}

function search_callback_OLD($form, $form_state) {
  return $form['table'];
}
?>
