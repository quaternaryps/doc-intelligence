<?php
function validate_login_view($docman) {
  if (!user_is_logged_in()) {
    return 'You must log in before you can view documents.';
  }

  global $user;
  if (!isset($user->roles[4]) &&
    isset($docman->field_legal['und'][0]['value']) &&
    $docman->field_legal['und'][0]['value'] == 1) {
    return 'You don\'t have permission to view legal documents.';
  }

  return drupal_get_form('docman_page_view', $docman);
}

function docman_page_view($form, &$form_state, $docman) {
//  drupal_add_js(drupal_get_path('module', 'docman') . '/iframeUpdateSend.js');

  $mode = 'full';
  field_attach_prepare_view('docman', array($docman->pid => $docman), $mode);
  entity_prepare_view('docman', array($docman->pid => $docman));
  $docman_content = field_attach_view('docman', $docman, $mode);

  global $base_root;

  $details = '<br />';
  foreach ($docman_content as $field => $content) {
    if (str_begins_with($field, 'field_')) {
      $item = $content[0];
      if (isset($item['#markup'])) {
        $title = $content['#title'];
        $info = $item['#markup'];

        if ($title == 'Policy') {
          $info = '<a href=' . $base_root . '/policy/' . $info . '>' . $info . '</a>';
        }

        $details .= '<b>' . $title . '</b><br />' . $info . '<br />';
      }
    }
  }

  $doc = (array) $docman_content['field_document'][0]['#file'];

  $email = array();
  $fax = array();
  /*
  global $user;
  if ($user->uid == 1) {
    $email = array(
      '#type' => 'link',
      '#title' => 'Email',
      '#suffix' => ' | ',
      '#href' => 'email/' . $docman->pid,
      '#ajax' => array(
        'wrapper' => 'send',
        'method' => 'html',
        'progress' => 'none',
        'effect' => 'slide',
      ),
    );
    $fax = array(
      '#type' => 'link',
      '#title' => 'Fax',
      '#suffix' => ' | ',
      '#href' => 'fax/' . $docman->pid,
      '#ajax' => array(
        'wrapper' => 'send',
        'method' => 'html',
        'progress' => 'none',
        'effect' => 'slide',
      ),
    );
  }*/

  $form = array(
    'edit' => array(
      '#type' => 'link',
      '#title' => 'Edit',
      '#href' => $base_root . '/upload/' . $docman->pid,
      //'#suffix' => ' | ',
    ),
    /*'email' => $email,
    'fax' => $fax,
    'print' => array(
      '#type' => 'link',
      '#title' => 'Print',
      '#suffix' => ' | ',
    ),
    'flip' => array(
      '#type' => 'link',
      '#title' => 'Flip',
      '#href' => 'flip/' . $docman->pid,
      '#ajax' => array(
        'wrapper' => 'thumb',
        'method' => 'html',
        'progress' => 'none',
      ),
    ),
    'send' => array(
      '#prefix' => '<div id="send">',
      '#suffix' => '</div>',
    ),*/
    'details' => array(
      '#markup' => '
        <table>
          <tr>
            <td align="center">' . get_thumb($doc) . '</div></td>
            <td align="left" valign="baseline" width="250px">
              <h1>Details</h1>' . $details . '</td>
          </tr>
        </table>',
      '#prefix' => '<div align="center">',
      '#suffix' => '</div>',
    ),
    'history' => array(
      '#markup' => view_history($docman->pid),
    ),
  );

  if (isset($form_state['values']['email'])) {
    $form['send'] = send_form($docman->pid);
  }

  return $form;
}

function email_callback($form, $form_state) {
  //$form_state['values']['send'] = TRUE;
  return $form['send'];

  $page = array(
    '#type' => 'ajax',
    '#commands' => array(ajax_command_replace(
      '#send', drupal_render($form)))
  );

  ajax_deliver($page);
}

function fax_callback($docman) {
  send_form($form, $docman->pid);
  $form['subject']= array();
  $form['message']['#title'] = 'Cover Page';

  $page = array(
    '#type' => 'ajax',
    '#commands' => array(ajax_command_replace(
      '#send', drupal_render($form)))
  );

  ajax_deliver($page);
}

function send_form($pid) {
  return array(
    '#prefix' => '<div id="send">',
    '#suffix' => '</div>',
    'to' => array(
      '#type' => 'textarea',
      '#title' => 'To',
      '#rows' => 1,
      '#resizable' => FALSE,
    ),
    'subject' => array(
      '#type' => 'textarea',
      '#title' => 'Subject',
      '#rows' => 1,
      '#resizable' => FALSE,
    ),
    'message' => array(
      '#type' => 'textarea',
      '#title' => 'Message',
      '#resizable' => FALSE,
    ),
    'buttons' => array(
      '#attributes' => array('class' => array('container-inline')),
      'send' => array(
        '#type' => 'button',
        '#value' => 'Send',
      ),
      'cancel' => array(
        '#type' => 'button',
        '#button_type' => 'button',
        '#value' => 'Cancel',
//        '#callback'
//        '#redirect' => $base_root . '/docman/' . $pid,
/*        '#ajax' => array(
          'callback' => 'cancel_callback',
          'method' => 'replace',
          'wrapper' => 'send',
          'progress' => 'none',
          'effect' => 'slide',
        ),*/
      ),
    ),
  );
}

function send_callback($form, $form_state) {}

function cancel_callback($a) {//$form, $form_state) {
  return $a;
  dpm($a);
  return;
  $page = array(
    '#type' => 'ajax',
    '#commands' => array(ajax_command_remove('#send_form'))
   );

  ajax_deliver($page);
}

function thumb_flip_callback($docman) {
  $mode = 'full';
  field_attach_prepare_view('docman', array($docman->pid => $docman), $mode);
  entity_prepare_view('docman', array($docman->pid => $docman));
  $docman_content = field_attach_view('docman', $docman, $mode);
  $doc = (array) $docman_content['field_document'][0]['#file'];

  $thumb_uri = 'public://Thumbnails/' . $doc['fid'] . '.png';
  if (file_exists($thumb_uri)) {
    unlink($thumb_uri);
  }

  $is_image =
    str_ends_with($doc['uri'], '.jpg')  ||
    str_ends_with($doc['uri'], '.jpeg') ||
    str_ends_with($doc['uri'], '.png') ||
    str_ends_with($doc['uri'], '.bmp') ||
    str_ends_with($doc['uri'], '.gif');

  if ($is_image) {
    $im = new Imagick();
    $im->readImage($doc['uri']);
    $im->rotateImage(new ImagickPixel(), 180);
    $im->writeImage(drupal_realpath($doc['uri']));
  }
  else if (str_ends_with($doc['filename'], '.pdf')) {
    $path = drupal_realpath($doc['uri']);
    $temp_path = substr($path, 0, -4) . '-(pdf180).pdf';

    exec('pdfjam \'' . $path . '\' --suffix \'(pdf180)\' --angle 180 ' .
      '--outfile ' . drupal_realpath('public://Documents'), $o, $ret);
    
    if ($ret == 0) {
      exec('sudo mv --force \'' . $temp_path . '\' \'' . $path . '\'');
    }
  }

  $page = array(
    '#type' => 'ajax',
    '#commands' => array(ajax_command_replace('#thumb', get_thumb($doc))),
  );

  ajax_deliver($page);
}

function get_thumb($doc) {
  return '
    <div id="thumb">
      <a href=' . file_create_url($doc['uri']) . '>
        <img width="550px" src=' . get_thumb_url($doc) . '>
      </a>
    </div>';
}

function view_history($pid) {
  $revision = array(
    'bundle' => 'docman',
    'pid' => $pid,
  );
  $revision = (object) $revision;

  $fields = field_info_instances('docman', 'docman');

  foreach ($fields as $field => $info) {
    $revision_tables[] = '{field_revision_' . $field . '}';
  }

  foreach ($revision_tables as $table) {
    $revision = db_query(
      'SELECT * FROM ' . $table . ' WHERE entity_id =' . $pid)->fetchAll();

    foreach ($revision as $rev) {
      $field = '';
      $data = '';
      foreach ($rev as $info => $value) {
        if (str_ends_with($info, 'value') || str_ends_with($info, 'fid') ||
          str_ends_with($info, 'date_time')) {
          $field = $info;
          $data = $value;
          break;
        }
      }
      $revisions[$rev->revision_id][$field] = $data;
    }
  }

  $vids = db_query(
    'SELECT * FROM {docman_revision} WHERE pid =' . $pid)->fetchAll();

  $markup = '<br /><hr /><br /><h1 class="with-tabs">History</h1><br /><br />';

  for ($i = 0; $i < count($vids); $i++) {
    $current_fields = $revisions[$vids[$i]->vid];
    $previous_fields = $i > 0 ? $revisions[$vids[$i - 1]->vid] : array();

    $markup .= 'On ' . format_date($vids[$i]->timestamp, 'short') .
      ', ' . get_username($vids[$i]->uid) . ':<blockquote>';

    foreach ($current_fields as $field => $value) {
      $remove_length = str_ends_with($field, 'value') ? -6 :
        (str_ends_with($field, 'date_time') ? -10 :
        (str_ends_with($field, 'fid') ? -4 : 0));
      $title = $fields[substr($field, 0, $remove_length)]['label'];

      $display = $value;
      if ($title == 'Document') {
        $file = db_query(
          'SELECT * FROM {file_managed} WHERE fid = ' . $value)->fetch();
        $display = '<a href=' . file_create_url($file->uri) .
          '>' . $file->filename . '</a>';
      }

      if (isset($previous_fields[$field])) {
        if ($previous_fields[$field] != $value) {
          $markup .= 'Changed <b>' . $title . '</b> to ' . $display . '<br />';
        }
        unset($previous_fields[$field]);
      }
      else {
        $markup .= 'Set <b>' . $title . '</b> to ' . $display . '<br />';
      }
    }

    foreach ($previous_fields as $field => $value) {
      $remove_length = str_ends_with($field, 'value') ? -6 :
        (str_ends_with($field, 'date_time') ? -10 :
        (str_ends_with($field, 'fid') ? -4 : 0));
      $title = $fields[substr($field, 0, $remove_length)]['label'];
      $markup .= 'Removed <b>' . $title . '</b><br />';
    }

    if (str_ends_with($markup, '<blockquote>')) {
      $markup .= 'Made no changes';
    }

    $markup .= '</blockquote><br />';
  }

  return $markup;
}
?>
