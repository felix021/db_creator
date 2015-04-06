<?php
header("Content-Type: application/json; charset=utf-8");

require('func.php');

/*
$_REQUEST = array(
    'type'  => 'table',
    'reg'   => 'T_',
    'value' => '1',
);
// */

$type = basename($_REQUEST['type']);
type_check($type);

$reg = null;
if (isset($_REQUEST['reg']))
    $reg = '/' . stripslashes_gpc($_REQUEST['reg']) . '/i';

$dirname = pwd() . '/' . $type . '/';
if (!is_dir($dirname))
    err('999', 'bad dirname: ' . $dirname);

$files = scandir($dirname);

$results = array();
foreach ($files as $file)
{
    $fullpath = $dirname . $file;
    if (!is_file($fullpath) or substr($file, -3) != '.js')
        continue;
    $basename = substr($file, 0, -3);
    if (is_null($reg) or preg_match($reg, $basename))
    {
        if (isset($_REQUEST['value']) and $_REQUEST['value'] == 1) {
            $obj = json_decode(file_get_contents($fullpath));
            if (!$obj) {
                err('999', 'corrupted data in: ' . $file);
            }
            $results[$basename] = $obj;
        }
        else { //only names
            array_push($results, $basename);
        }
    }
}

ok($results, TYPE_OBJECT);

?>
