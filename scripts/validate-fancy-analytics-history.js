'use strict';
const assert=require('assert');
const {createFancyAnalyticsHistoryReader}=require('../src/services/FancyAnalyticsHistory');
(async()=>{let sql='',params=[];const pool={query:async(s,p)=>{sql=s;params=p;return{rows:[{id:2,family:'HOME',channel:'facebook',publication_status:'published'}]}}};
const x=await createFancyAnalyticsHistoryReader(pool).getHistory({days:30,limit:50});
assert.strictEqual(x.mode,'OBSERVATION');assert.strictEqual(x.count,1);assert.strictEqual(x.items[0].family,'HOME');
assert.deepStrictEqual(params,[30,50]);assert(/^\s*SELECT/i.test(sql));assert(!/\b(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(sql));
assert.strictEqual(x.safeguards.readOnly,true);console.log('Fancy Analytics History validation: OK');
})().catch(e=>{console.error(e);process.exit(1)});
