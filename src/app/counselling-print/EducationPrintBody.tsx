import { dietStory, eduMedText, medDates, postStage, type EducationData, type EducationStage, type EduStageKey } from "@/lib/ipd-forms";

const hm = (t: string) => {
  if (!/^\d{2}:\d{2}$/.test(t)) return t;
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const h2 = "mt-5 mb-2 text-[13px] font-bold uppercase tracking-wide break-after-avoid";
const h3 = "mt-3 mb-1.5 text-[12.5px] font-bold break-after-avoid";

/** One stage: education points (main and added), medicines, then the diet chart. */
function StagePrint({ title, s, stage, surgeryDate, part }: { title: string; s: EducationStage; stage: EduStageKey; surgeryDate: string | null; part?: PrintPart }) {
  const story = dietStory(stage, s.dietDays, surgeryDate);
  const nbm = s.dietTypes.includes("Nil by mouth");
  const meds = s.meds ?? [];
  return (
    <section>
      <h2 className={h2}>{title}</h2>
      {part !== "diet" && <>
      <ol className="list-decimal pl-5 space-y-1.5 text-[12.5px] leading-[1.6]">
        {s.points.map((p, i) => <li key={i}>{p.text}</li>)}
      </ol>
      {(s.sets ?? []).filter((x) => x.points.length > 0).map((x) => (
        <div key={x.id} className="break-inside-avoid">
          <p className={h3}>{x.title}</p>
          <ol className="list-decimal pl-5 space-y-1.5 text-[12.5px] leading-[1.6]">
            {x.points.map((p, i) => <li key={i}>{p.text}</li>)}
          </ol>
        </div>
      ))}
      {meds.length > 0 && (
        <div className="break-inside-avoid">
          <p className={h3}>Medicines</p>
          <ol className="list-decimal pl-5 space-y-1 text-[12.5px] leading-[1.6]">
            {meds.map((m) => {
              const dates = medDates(stage, m.duration, surgeryDate);
              return <li key={m.id}>{eduMedText(m)}{dates ? ` (${dates})` : ""}</li>;
            })}
          </ol>
        </div>
      )}
      {s.notes.trim() && <p className="mt-3 text-[12.5px] leading-[1.6]"><b>Notes: </b>{s.notes}</p>}
      </>}
      {part !== "education" && <>

      {part !== "diet" && <p className={h3}>Diet</p>}
      {story && <p className="text-[12.5px] mb-1 italic">{story}</p>}
      <p className="text-[12.5px] mb-2">
        {s.dietTypes.join(", ") || "-"}
        {nbm && s.nbmFrom && <> · <b>Nil by mouth from </b>{hm(s.nbmFrom)}</>}
      </p>
      {!nbm && s.meals.length > 0 && (
        <table className="w-full border-collapse text-[12px] break-inside-avoid">
          <thead>
            <tr className="bg-gray-100">
              {["Meal Plan", "Time", "Diet"].map((h) => <th key={h} className="border border-gray-400 px-2 py-1.5 text-left font-bold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {s.meals.map((m, i) => (
              <tr key={i}>
                <td className="border border-gray-400 px-2 py-1.5 font-semibold whitespace-nowrap">{m.meal}</td>
                <td className="border border-gray-400 px-2 py-1.5 whitespace-nowrap">{hm(m.time)}</td>
                <td className="border border-gray-400 px-2 py-1.5">{m.diet || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </>}
    </section>
  );
}

/** Pre-op and post-op education, medicines and diet, below the print header (Education print and the combined Counselling print). */
export type PrintPart = "education" | "diet";

/** Pre-op and post-op education and diet; `part` prints only one of them. */
export function EducationPrintBody({ e, surgeryDate, part }: { e: EducationData; surgeryDate: string | null; part?: PrintPart }) {
  const pre = e.pre;
  const post = postStage(e);
  return (
    <>
      {pre && <StagePrint title={part === "diet" ? "Diet before the operation (pre-op)" : "Before the operation (pre-op)"} s={pre} stage="pre" surgeryDate={surgeryDate} part={part} />}
      <StagePrint title={part === "diet" ? "Diet after the operation (post-op)" : "After the operation (post-op)"} s={post} stage="post" surgeryDate={surgeryDate} part={part} />

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
