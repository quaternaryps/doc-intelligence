<?php
function validate_login_search() {
  if (!user_is_logged_in()) {
    return 'You must log in before you can search documents.';
  }
  return drupal_get_form('docman_search_form');
}

function docman_search_form($form, &$form_state) {
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
    'search',
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
    if (strlen($term) === 0) {
      unset($search_terms[$index]);
    }
  }
  
  $search_term_count = count($search_terms);
  if ($search_term_count === 0) {
    return;
  }
  
  $skip_headers = array('Document', 'Recieved On');
  $fields = field_info_instances('docman', 'docman');
  $header = array();
  unset($fields['field_legal']);
  
  foreach ($fields as $field) {
    $label = $field['label'];
    $header[$label]['data'] = $label;
    if (!in_array($label, $skip_headers)) {
      $field_name = $field['field_name'];
      $header[$label]['field'] = $field_name;
      $header[$label]['specifier'] = $field_name;
    }
  }
  
  $entities_raw = array();
  $show_legal = isset($user->roles[4]);
  
  foreach ($search_terms as $search_term) {
    $term_entities = array();
    foreach ($fields as $field) {
      if (!in_array($field['label'], $skip_headers)) {
        $new_entities = doQuery($field['field_name'], $search_term, $show_legal);
        $term_entities = array_merge($term_entities, $new_entities);
      }
    }
    array_push($entities_raw, $term_entities);
  }
  
  $entities = array();
  
  if ($search_term_count === 1) {
    $entities = $entities_raw[0];
  }
  else {
    array_push($entities_raw, 'entity_compare');
    $entities = call_user_func_array('array_uintersect', $entities_raw);
  }
  
  if (array_key_exists('order', drupal_get_query_parameters())) {
    usort($entities, 'row_compare');
  }
  else {
    usort($entities, 'default_compare');
  }
  
  $add['actions']['data'] = 'Actions';
  //$add['owner']['data'] = 'Last Touched';
  $header = $add + $header;
  
  $skip_fields = array('vid', 'timestamp', 'pid',
    'created', 'changed', 'rdf_mapping', 'field_legal');

  $rows = array();
  foreach ($entities as $entity) {
    $details_url = $base_root . '/docman/' . $entity->pid;
    $edit_url = $base_root . '/upload/' . $entity->pid;
    $rows[$entity->pid]['data'][] = '<a href=' . $details_url . '>Details</a>
      <br /><a href=' . $edit_url . '>Edit</a>';
    
    foreach ($entity as $field => $cell) {
      if (!in_array($field, $skip_fields)) {
        if (empty($cell)) {
          $rows[$entity->pid]['data'][] = '';
        }
        else if (isset($cell['und'])) {
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
          else if ($field === 'field_policy') {
            $value = '<a href=' . $base_root . '/policy/' .
              $parent['value'] . '>' . $parent['value'] . '</a>';
          }
          else {
            $value = isset($parent['date_time']) ?
              $parent['date_time'] : $parent['value'];
          }

          $rows[$entity->pid]['data'][$field] =
            '<div class="row">' . $value . '</div>';
        }
      }
    }
  }
  
  $count_string = 'No documents to display';
  $result_count = count($rows);
  if (count($search_terms) > 0) {
    $count_string = $result_count . ' document' .
      ($result_count > 1 ? 's ' : ' ') . 'found containing the term' .
      ($search_term_count > 1 ? 's ' : ' ');
    foreach ($search_terms as $term) {
      $count_string .= '"<b>' . str_replace('+', ' ', $term) . '</b>", ';
    }
    $count_string = substr($count_string, 0, -2) . '.';
  }

  $per_page = 10;
  $current_page = pager_default_initialize($result_count, $per_page);
  $chunks = array_chunk($rows, $per_page, TRUE);
  
  return array(
    'count' => array(
      '#type' => 'item',
      '#disabled' => TRUE,
      '#markup' => $count_string,
    ),
    'table' => array(
      '#theme' => 'table',
      '#header' => $result_count > 0 ? $header : array(),
      // '#rows' => $rows,
      '#rows' => $result_count > 0 ? $chunks[$current_page] : $rows,
    ),
    'pager' => array(
      '#theme' => 'pager',
    ),
  );
}

function entity_compare($a, $b) {
  return $a->vid - $b->vid;
}

function row_compare($a, $b) {
  $a = (array)$a;
  $b = (array)$b;
  
  $params = drupal_get_query_parameters();
  $field = 'field_' . strtolower(str_replace(' ', '_', $params['order']));
  
  if (!array_key_exists($field, $a) || !array_key_exists('und', $a[$field])) {
    return 1;
  }
  if (!array_key_exists($field, $b) || !array_key_exists('und', $b[$field])) {
    return -1;
  }
  
  $cmp = strcasecmp($a[$field]['und'][0]['value'], $b[$field]['und'][0]['value']);
  if ($params['sort'] === 'desc') {
    $cmp *= -1;
  }
  return $cmp;
}

function default_compare($a, $b) {
  $a = $a->field_document;
  $b = $b->field_document;
  return $b['und'][0]['fid'] - $a['und'][0]['fid'];
}

function doQuery($search_field, $search_term, $show_legal) {
  $query = new EntityFieldQuery();
  $query->entityCondition('entity_type', 'docman');
  
  unset($query->{'order'}[1]);
  unset($query->{'fields'}[1]);
	
  $search = '%' . $search_term . '%';
  $query->fieldCondition($search_field, 'value', $search, 'LIKE');
  if (!$show_legal) {
    // TODO Test if this is working
    $query->fieldCondition('field_legal', 'value', '0', '=');
  }
  
  $query_results = $query->execute();
  return count($query_results) > 0
    ? docman_load_multiple(array_keys($query_results['docman']))
    : array();
}
?>
