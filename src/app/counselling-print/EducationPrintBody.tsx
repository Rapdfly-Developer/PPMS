import type { EducationData } from "@/lib/ipd-forms";

const hm = (t: string) => {
  if (!/^\d{2}:\d{2}$/.test(t)) return t;
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** The education points and diet chart, below the print header (Education print and the combined Counselling print). */
export function EducationPrintBody({ e }: { e: EducationData }) {
  const nbm = e.dietTypes.includes("Nil by mouth");
  return (
    <>
      <h2 className="mt-2 mb-2 text-[13px] font-bold uppercase tracking-wide">Instructions{e.preset ? ` · ${e.preset}` : ""}</h2>
      <ol className="list-decimal pl-5 space-y-1.5 text-[12.5px] leading-[1.6]">
        {e.points.map((p, i) => <li key={i}>{p.text}</li>)}
      </ol>
      {e.notes.trim() && <p className="mt-3 text-[12.5px] leading-[1.6]"><b>Notes: </b>{e.notes}</p>}

      <h2 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-wide break-after-avoid">Diet chart</h2>
      <p className="text-[12.5px] mb-2">
        <b>Diet: </b>{e.dietTypes.join(", ") || "-"}
        {nbm && e.nbmFrom && <> · <b>Nil by mouth from </b>{hm(e.nbmFrom)}</>}
      </p>
      {!nbm && e.meals.length > 0 && (
        <table className="w-full border-collapse text-[12px] break-inside-avoid">
          <thead>
            <tr className="bg-gray-100">
              {["Meal", "Time", "Diet"].map((h) => <th key={h} className="border border-gray-400 px-2 py-1.5 text-left font-bold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {e.meals.map((m, i) => (
              <tr key={i}>
                <td className="border border-gray-400 px-2 py-1.5 font-semibold whitespace-nowrap">{m.meal}</td>
                <td className="border border-gray-400 px-2 py-1.5 whitespace-nowrap">{hm(m.time)}</td>
                <td className="border border-gray-400 px-2 py-1.5">{m.diet || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-10 grid grid-cols-2 gap-10 text-[11.5px] break-inside-avoid">
        <div>
          <p className="border-t border-gray-800 pt-1"><b>Explained by</b></p>
          <p>Name: ____________________</p>
        </div>
        <div>
          <p className="border-t border-gray-800 pt-1"><b>Received by (patient / relative)</b></p>
          <p>Name: ____________________</p>
        </div>
      </div>
    </>
  );
}
