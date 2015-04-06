#!/usr/bin/python

try:
    import simplejson as json
except:
    import json

#from stdin to stdout
import sys
if len(sys.argv) > 1:
    f = open(sys.argv[1])
    json_in = f.read()
    f.close()
else:
    json_out = sys.stdin.read()
    

json_out = json.dumps(json.loads(json_in), indent=4)

if len(sys.argv) > 1:
    f = open(sys.argv[1], 'w')
else:
    f = sys.stdout
f.write(json_out)
f.close()
