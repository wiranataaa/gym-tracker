import { cekDeload } from "../lib/report/deloadCek.ts";
import { getSettings } from "../lib/workout/db.ts";
const st = await getSettings();
console.log("deload_aktif:", st.deload_aktif, "| sampai:", st.deload_sampai, "| terakhir:", st.deload_terakhir);
console.log(await cekDeload(new Date().toISOString().slice(0,10)));
