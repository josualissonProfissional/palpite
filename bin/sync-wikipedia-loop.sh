#!/bin/bash
URL="https://zhlpxcdvsbfvjhmospbx.supabase.co/functions/v1/sync-wikipedia-photos"
AUTH="Authorization: Bearer sb_publishable_avt9-Gl2l34xu0CBoAdQMA_NAo1PVNF"
SECRET="x-internal-secret: palpite-internal-2026"
total=0
for i in $(seq 1 200); do
  result=$(curl -s -X POST "$URL" -H "$SECRET" -H "$AUTH" -H "Content-Type: application/json")
  s=$(echo "$result" | python3 -c "import json,sys;print(json.load(sys.stdin).get('synced',0))" 2>/dev/null)
  r=$(echo "$result" | python3 -c "import json,sys;print(json.load(sys.stdin).get('remaining',0))" 2>/dev/null)
  total=$((total + s))
  echo "$(date +%H:%M:%S) [$i] +$s total=$total remaining=$r"
  if [ "$r" = "0" ]; then echo "ALL DONE!"; break; fi
  if [ "$s" = "0" ] && [ $i -gt 30 ]; then echo "No more matches after 30 dry runs"; break; fi
done
echo "FINAL: $total synced, $r remaining"
