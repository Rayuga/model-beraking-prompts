import argparse
import concurrent.futures
import copy
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / "projects/ridgeline-print-storefront"
SEED = json.loads((TASK / "environment/assets/seed_data.json").read_text(encoding="utf-8"))
VARIANTS = {(v["sku"], v["size"]): v for v in SEED["variants"]}
WEIGHTS = {w["size"]: w["grams"] for w in SEED["size_weights"]}
BANDS = sorted((b for b in SEED["postage_bands"] if b["up_to_grams"] > 0), key=lambda b:b["up_to_grams"])
ADDRESS = {"name":"QC Buyer","line1":"12 Print Lane","line2":"","city":"Bristol","postcode":"BS1 4AA","country":"United Kingdom"}
RESULT = {"kind":"local deterministic API and SQLite evidence; not a browser-judge or paid Oracle score","checks":[],"requests":[]}
parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:3311")
parser.add_argument("--container", default="ridgeline-api-hardening")
args = parser.parse_args()
LOCAL_HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))

def check(name, condition, observed=None):
    row = {"check":name,"passed":bool(condition)}
    if observed is not None: row["observed"] = observed
    RESULT["checks"].append(row)
    if not condition: raise AssertionError(name + ": " + repr(observed))

def http(method,path,body=None):
    raw = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(args.url+path,data=raw,method=method,headers={"Content-Type":"application/json"})
    try:
        with LOCAL_HTTP.open(request,timeout=20) as response:
            status, payload = response.status, response.read()
    except urllib.error.HTTPError as response:
        status, payload = response.code, response.read()
    try: data = json.loads(payload)
    except Exception: data = {"raw":payload.decode(errors="replace")}
    RESULT["requests"].append({"method":method,"path":path,"status":status,"body":body,"response":data})
    return status,data

def catalogue():
    status,data=http("GET","/api/prints")
    assert status==200, (status,data)
    return data["prints"]

def stocks():
    return {v["sku"]+":"+v["size"]:v["in_stock"] for p in catalogue() for v in p["sizes"]}

def db_counts():
    code = """const D=require('better-sqlite3');const d=new D(process.env.DB_PATH||'/app/app.db',{readonly:true});const r={};for(const t of ['variants','orders','order_lines','meta'])r[t]=d.prepare('SELECT COUNT(*) n FROM '+t).get().n;console.log(JSON.stringify(r));d.close();"""
    value=subprocess.check_output(["docker","exec",args.container,"node","-e",code],text=True,encoding="utf-8")
    return json.loads(value)

def snapshot():
    return {"stocks":stocks(),"counts":db_counts()}

def lines(*entries):
    return [{"sku":sku,"size":size,"qty":qty} for sku,size,qty in entries]

def request_body(entries, **extra):
    return {"lines":copy.deepcopy(entries),"address":copy.deepcopy(ADDRESS),"checkout_id":str(uuid.uuid4()),**extra}

def expected_quote(entries):
    quantities={}
    for row in entries:
        key=(row["sku"],row["size"])
        quantities[key]=quantities.get(key,0)+row["qty"]
    gross=saving=grams=0
    for key,qty in quantities.items():
        v=VARIANTS[key]
        charge=v["tier_price_pence"] if qty>=v["tier_qty"] else v["price_pence"]
        gross+=v["price_pence"]*qty
        saving+=(v["price_pence"]-charge)*qty
        grams+=WEIGHTS[key[1]]*qty
    band=next((b for b in BANDS if grams<=b["up_to_grams"]),None)
    postage=band["price_pence"] if band else 0
    if not quantities: postage=0
    return {"subtotal_pence":gross,"trade_saving_pence":saving,"postage_pence":postage,"total_pence":gross-saving+postage,"weight_grams":grams}

def receipt(name,order,entries):
    expected=expected_quote(entries)
    check(name+" authoritative figures",all(order.get(k)==v for k,v in expected.items()),{"actual":{k:order.get(k) for k in expected},"expected":expected})
    got={(r["sku"],r["size"]):r for r in order["lines"]}
    aggregated={}
    for row in entries:
        k=(row["sku"],row["size"])
        aggregated[k]=aggregated.get(k,0)+row["qty"]
    check(name+" unique combined order lines",set(got)==set(aggregated) and len(order["lines"])==len(aggregated))
    for k,qty in aggregated.items():
        v=VARIANTS[k]
        unit=v["tier_price_pence"] if qty>=v["tier_qty"] else v["price_pence"]
        check(name+" stored line "+":".join(k),got[k]["qty"]==qty and got[k]["unit_price_pence"]==unit and got[k]["base_unit_price_pence"]==v["price_pence"] and got[k]["line_total_pence"]==unit*qty and bool(got[k]["trade_applied"])==(qty>=v["tier_qty"]),got[k])

def place(name,entries,**extra):
    body=request_body(entries,**extra)
    status,order=http("POST","/api/orders",body)
    check(name+" creates order",status==201 and order.get("status")=="placed",{"status":status,"order":order})
    receipt(name,order,entries)
    check(name+" saved address",all(order.get("address_"+k)==v for k,v in body["address"].items()),order)
    return body,order

def get_order(ref):
    status,data=http("GET","/api/orders/"+ref)
    assert status==200,(status,data)
    return data

def refusal(name,body):
    before=snapshot()
    status,data=http("POST","/api/orders",body)
    after=snapshot()
    check(name+" no success receipt",status>=400 and "reference" not in data,{"status":status,"body":data})
    check(name+" all stocks/order counts unchanged",before==after,{"before":before,"after":after})
    return data

def quote_case(name,entries):
    status,data=http("POST","/api/basket/price",{"lines":entries})
    check(name+" quote succeeds",status==200,data)
    expected=expected_quote(entries)
    normalized={**data,"postage_pence":data.get("postage",{}).get("price_pence")}
    check(name+" quote figures",all(normalized.get(k)==v for k,v in expected.items()),{"actual":{k:normalized.get(k) for k in expected},"expected":expected})
    return data

def cancel(ref):
    status,data=http("POST","/api/orders/"+ref+"/cancel",{})
    assert status==200,(status,data)
    return data

def stable_receipt(order):
    return {k:v for k,v in order.items() if k not in ["status","cancelled_at","cancellable"]}

try:
    status,health=http("GET","/api/health")
    check("health available",status==200 and health.get("ok"),health)
    initial=snapshot()
    check("fresh seeded fixture",initial["counts"]=={"variants":13,"orders":1,"order_lines":1,"meta":1},initial)
    seed_stocks={v["sku"]+":"+v["size"]:v["in_stock"] for v in SEED["variants"]}
    check("exact seed stocks",initial["stocks"]==seed_stocks)
    prints=catalogue()
    check("eight print identities",len(prints)==8 and len({p["sku"] for p in prints})==8)
    check("per-size sold-out independence",next(p for p in prints if p["sku"]=="RP-102")["buyable"] and not next(p for p in prints if p["sku"]=="RP-107")["buyable"])
    quote_case("valid Harbour A3",lines(("RP-102","A3",1)))
    quote_case("valid last Slack A2",lines(("RP-104","A2",1)))
    status,data=http("POST","/api/basket/price",{"lines":lines(("RP-104","A2",2))})
    check("basket excess says actual available",status==409 and data.get("available")==1,data)
    quote_case("Night Ferry A2 two-unit basket",lines(("RP-108","A2",2)))
    quote_case("empty basket zero payable",[])
    status,data=http("POST","/api/basket/price",{"lines":lines(("RP-108","A2",0))})
    check("zero preview removes line",status==200 and data["lines"]==[] and data["total_pence"]==0,data)
    quote_case("threshold below",lines(("RP-108","A3",4),("RP-108","A2",1)))
    quote_case("threshold meets exact variant",lines(("RP-108","A3",5),("RP-108","A2",1)))
    quote_case("threshold drops back below",lines(("RP-108","A3",4),("RP-108","A2",1)))
    quote_case("90 grams",lines(("RP-103","A3",1)))
    quote_case("500 grams",lines(("RP-103","A3",2),("RP-101","A2",2)))
    quote_case("2000 grams",lines(("RP-103","A3",8),("RP-101","A2",4),("RP-108","A2",4)))
    over=quote_case("2090 grams",lines(("RP-103","A3",9),("RP-101","A2",4),("RP-108","A2",4)))
    check("collection-only above final band",over["postage"]["collection_only"] and over["postage"]["price_pence"]==0,over["postage"])
    check("all previews leave durable database unchanged",snapshot()==initial)

    historical=get_order("RP-100001")
    check("historical charged values",historical["status"]=="dispatched" and historical["total_pence"]==7320 and historical["lines"][0]["unit_price_pence"]==3500 and historical["lines"][0]["qty"]==2,historical)
    hist_body,hist_new=place("current Long Field purchase",lines(("RP-101","A3",1)))
    check("historical receipt not repriced",get_order("RP-100001")==historical)
    check("current LF stock 11",stocks()["RP-101:A3"]==11)
    status,data=http("GET","/api/orders/RP-UNKNOWN-QC")
    check("unknown order absent",status==404 and "reference" not in data,data)

    mixed_lines=lines(("RP-101","A3",2),("RP-105","A3",1),("RP-106","A3",5))
    mixed_body,mixed=place("mixed trade",mixed_lines)
    receipt("mixed durable reread",get_order(mixed["reference"]),mixed_lines)
    check("mixed per-variant stocks",all(stocks()[k]==n for k,n in {"RP-101:A3":9,"RP-105:A3":6,"RP-106:A3":9}.items()),stocks())

    price_body,price_control=place("price control",lines(("RP-106","A2",1)))
    forged=request_body(lines(("RP-106","A2",1)),unit_price_pence=1,subtotal_pence=1,total_pence=1,postage_pence=0,trade_saving_pence=999999)
    forged["lines"][0].update({"unit_price_pence":1,"price_pence":1,"line_total_pence":1})
    before=snapshot()
    status,price_forged=http("POST","/api/orders",forged)
    check("forged price safely handled",status==201 or status>=400,{"status":status,"order":price_forged})
    if status==201:
        receipt("forged price authoritative receipt",get_order(price_forged["reference"]),forged["lines"])
        check("forged accepted costs one unit",stocks()["RP-106:A2"]==1)
    else:
        check("forged refusal no mutation",snapshot()==before)
    check("price control immutable",get_order(price_control["reference"])==price_control)

    nw_body,nw_control=place("Nine Windows quantity control",lines(("RP-103","A3",1)))
    combined=lines(("RP-103","A3",3),("RP-103","A3",2))
    quote_case("duplicate preview merges trade",combined)
    duplicate_body,duplicate=place("duplicate checkout merges trade",combined)
    check("duplicate checkout stock fourteen",stocks()["RP-103:A3"]==14)
    refusal("combined duplicate overstock",request_body(lines(("RP-103","A3",8),("RP-103","A3",7))))
    for qty in [0,-1,1.5,True,None,"",9007199254740992]:
        refusal("invalid checkout quantity "+repr(qty),request_body(lines(("RP-103","A3",qty))))
    refusal("valid plus unknown variant",request_body(lines(("RP-103","A3",1),("RP-999","A3",1))))
    refusal("empty checkout",request_body([]))
    refusal("missing checkout identity",{"lines":lines(("RP-103","A3",1)),"address":ADDRESS})
    refusal("incomplete address",request_body(lines(("RP-103","A3",1)),address={**ADDRESS,"postcode":""}))
    check("both quantity receipts unchanged",get_order(nw_control["reference"])==nw_control and get_order(duplicate["reference"])==duplicate)

    stale=request_body(lines(("RP-102","A3",2),("RP-101","A3",1)))
    quote_case("stale cart valid before competing buy",stale["lines"])
    stale_long_before=stocks()["RP-101:A3"]
    competing_body,competing=place("atomic competing buy",lines(("RP-102","A3",8)))
    refusal("stale multi-line checkout atomic",stale)
    check("valid companion untouched",stocks()["RP-101:A3"]==stale_long_before and stocks()["RP-102:A3"]==1)
    check("competing order unchanged",get_order(competing["reference"])==competing)

    retry_body,retry_order=place("retry control",lines(("RP-108","A2",1)))
    retry_snapshot=snapshot()
    for i in range(2):
        status,replayed=http("POST","/api/orders",retry_body)
        check("exact retry "+str(i)+" same receipt",status==200 and replayed==retry_order,{"status":status,"order":replayed})
        check("exact retry "+str(i)+" no mutation",snapshot()==retry_snapshot)
    changed=copy.deepcopy(retry_body); changed["lines"][0]["qty"]=2
    refusal("same identity changed quantity",changed)
    changed=copy.deepcopy(retry_body); changed["address"]["line1"]="99 Another Street"
    refusal("same identity changed address",changed)
    second_body,second_retry=place("fresh same-basket purchase",lines(("RP-108","A2",1)))
    check("fresh purchase distinct and second decrement",second_retry["reference"]!=retry_order["reference"] and stocks()["RP-108:A2"]==2)

    cancel_body,cancel_order=place("cancellable trade order",lines(("RP-108","A3",5)))
    cancelled=cancel(cancel_order["reference"])
    check("cancel restores exactly five",cancelled["status"]=="cancelled" and stocks()["RP-108:A3"]==6)
    check("cancel preserves charged receipt",stable_receipt(cancelled)==stable_receipt(cancel_order))
    cancelled_snapshot=snapshot()
    for i in range(2):
        again=cancel(cancel_order["reference"])
        check("cancel repeat "+str(i)+" terminal",again==cancelled and snapshot()==cancelled_snapshot)
    status,replayed=http("POST","/api/orders",cancel_body)
    check("cancelled checkout replay terminal",status==200 and replayed==cancelled and snapshot()==cancelled_snapshot,replayed)
    before=snapshot()
    status,data=http("POST","/api/orders/RP-100001/cancel",{})
    check("dispatched cancellation refused",status>=400 and get_order("RP-100001")==historical and snapshot()==before,{"status":status,"data":data})

    race_control_body,race_control=place("last-copy race positive control",lines(("RP-104","A3",1)))
    race_requests=[request_body(lines(("RP-104","A3",1))) for _ in range(2)]
    race_before=db_counts()
    barrier=threading.Barrier(2)
    def contender(body):
        barrier.wait()
        return http("POST","/api/orders",body)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        raced=list(executor.map(contender,race_requests))
    winners=[(status,order) for status,order in raced if status==201]
    losers=[(status,order) for status,order in raced if status>=400]
    check("concurrent different attempts exactly one winner",len(winners)==1 and len(losers)==1,raced)
    check("concurrent final stock zero",stocks()["RP-104:A3"]==0)
    check("concurrent creates only one order",db_counts()["orders"]==race_before["orders"]+1)
    receipt("race winner",get_order(winners[0][1]["reference"]),lines(("RP-104","A3",1)))
    check("race original receipt preserved",get_order(race_control["reference"])==race_control)

    last_body,last=place("last Slack A2",lines(("RP-104","A2",1)))
    check("last A2 stock zero",stocks()["RP-104:A2"]==0)
    refusal("fresh last-unit oversell",request_body(lines(("RP-104","A2",1))))
    check("last receipt immutable",get_order(last["reference"])==last)

    lf_first_body,lf_first=place("successive LF regular order",lines(("RP-101","A2",2)))
    check("LF first leaves three",stocks()["RP-101:A2"]==3)
    lf_second_body,lf_second=place("successive LF trade order",lines(("RP-101","A2",3)))
    check("LF second leaves zero",stocks()["RP-101:A2"]==0)
    check("earlier LF price stays regular",get_order(lf_first["reference"])==lf_first)
    receipt("LF trade durable reread",get_order(lf_second["reference"]),lf_second_body["lines"])

    kiln_start=stocks()["RP-105:A3"]
    persist_cancel_body,persist_cancel_order=place("restart cancelled control",lines(("RP-105","A3",1)))
    persist_cancelled=cancel(persist_cancel_order["reference"])
    check("restart cancellation restores baseline",stocks()["RP-105:A3"]==kiln_start)
    persist_placed_body,persist_placed=place("restart placed control",lines(("RP-105","A3",1)))
    check("restart placed control decrements one",stocks()["RP-105:A3"]==kiln_start-1)
    durable_before=snapshot()
    process_before=subprocess.check_output(["docker","inspect","--format","{{.State.StartedAt}}",args.container],text=True).strip()
    subprocess.run(["docker","restart",args.container],check=True,stdout=subprocess.PIPE,text=True,timeout=40)
    for _ in range(100):
        try:
            status,_=http("GET","/api/health")
            if status==200: break
        except Exception: pass
        time.sleep(.2)
    else: raise AssertionError("Container did not become ready after actual restart")
    process_after=subprocess.check_output(["docker","inspect","--format","{{.State.StartedAt}}",args.container],text=True).strip()
    check("actual process/container restart observed",process_before!=process_after,{"before":process_before,"after":process_after})
    check("all stocks and database row counts survive restart",snapshot()==durable_before,{"before":durable_before,"after":snapshot()})
    check("cancelled receipt durable",get_order(persist_cancelled["reference"])==persist_cancelled)
    check("placed receipt durable",get_order(persist_placed["reference"])==persist_placed)
    for name,body,order in [("cancelled",persist_cancel_body,persist_cancelled),("placed",persist_placed_body,persist_placed)]:
        status,replayed=http("POST","/api/orders",body)
        check("restart "+name+" exact retry durable",status==200 and replayed==order and snapshot()==durable_before,{"status":status,"order":replayed})
    again=cancel(persist_cancelled["reference"])
    check("repeat cancellation after restart no extra restoration",again==persist_cancelled and snapshot()==durable_before)
    check("seed historical receipt preserved after restart",get_order("RP-100001")==historical)
    check("seed catalogue identities preserved after restart",len(catalogue())==8 and db_counts()["variants"]==13)
    check("old trade order remains charged correctly",get_order(lf_second["reference"])==lf_second)
    check("old cancellation remains terminal",get_order(cancelled["reference"])==cancelled)
    RESULT["final_state"]=snapshot()
    RESULT["passed"]=True
except Exception as error:
    RESULT["passed"]=False
    RESULT["error"]=repr(error)
    raise
finally:
    RESULT["assertion_count"]=len(RESULT["checks"])
    RESULT["passed_assertions"]=sum(c["passed"] for c in RESULT["checks"])
    (HERE/"backend_smoke_results.json").write_text(json.dumps(RESULT,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in RESULT.items() if k not in ["checks","requests"]},indent=2))
