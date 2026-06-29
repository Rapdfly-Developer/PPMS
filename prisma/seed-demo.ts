/**
 * Demo seed — adds today's rich data for the Doctor Dashboard.
 * Safe to re-run: clears today's doctor appointments first, then recreates them.
 */
import { PrismaClient } from "@prisma/client";
import { generateUDID } from "../src/lib/udid";
import { encryptAadhaar } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  // ── Find existing doctor & hospital ────────────────────────────────────────
  const doctorUser = await prisma.user.findFirst({ where: { username: "doctor" } });
  if (!doctorUser) throw new Error("Run main seed first: npx prisma db seed");

  const doctor = await prisma.doctor.findFirst({ where: { userId: doctorUser.id } });
  if (!doctor) throw new Error("Doctor record not found");

  const hospitalA = await prisma.hospital.findFirst({ where: { shortCode: "SEH" } });
  const hospitalB = await prisma.hospital.findFirst({ where: { shortCode: "LMH" } });
  if (!hospitalA || !hospitalB) throw new Error("Hospitals not found");

  // ── Today's time helpers ───────────────────────────────────────────────────
  const now   = new Date();
  const today = (h: number, m = 0) => {
    const d = new Date(now); d.setHours(h, m, 0, 0); return d;
  };
  const past  = (daysAgo: number) => {
    const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(10, 0, 0, 0); return d;
  };

  // ── Clear today's appointments for this doctor (safe re-run) ──────────────
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday   = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  await prisma.appointment.deleteMany({
    where: { doctorId: doctor.id, dateTime: { gte: startOfToday, lte: endOfToday } },
  });

  // ── Ensure we have 10 patients ─────────────────────────────────────────────
  const extraPatients = [
    { name: "Arjun Mehta",      age: 38, sex: "MALE",   mobile: "9100000001", complaint: "Sudden vision loss, right eye",       category: "GENERAL"    },
    { name: "Priya Nair",       age: 29, sex: "FEMALE", mobile: "9100000002", complaint: "Follow-up post cataract surgery",      category: "SUBSIDISED" },
    { name: "Venkatesh Rao",    age: 67, sex: "MALE",   mobile: "9100000003", complaint: "Glaucoma monitoring",                  category: "ECHS"       },
    { name: "Saira Banu",       age: 52, sex: "FEMALE", mobile: "9100000004", complaint: "Diabetic retinopathy screening",       category: "BPL"        },
    { name: "Karthik Selvam",   age: 45, sex: "MALE",   mobile: "9100000005", complaint: "Eye pain and watering, left eye",      category: "GENERAL"    },
    { name: "Deepa Thomas",     age: 33, sex: "FEMALE", mobile: "9100000006", complaint: "Routine refractive check",             category: "INSURANCE"  },
    { name: "Mohammed Ismail",  age: 58, sex: "MALE",   mobile: "9100000007", complaint: "Emergency: chemical splash, both eyes", category: "GENERAL"   },
    { name: "Anitha Krishnan",  age: 44, sex: "FEMALE", mobile: "9100000008", complaint: "Follow-up for dry eye treatment",      category: "GENERAL"    },
    { name: "Subramaniam P",    age: 71, sex: "MALE",   mobile: "9100000009", complaint: "Progressive cataract, left eye",       category: "BPL"        },
    { name: "Rekha Sundaram",   age: 36, sex: "FEMALE", mobile: "9100000010", complaint: "New onset floaters and flashes",       category: "GENERAL"    },
  ];

  const patients: any[] = [];
  for (const p of extraPatients) {
    const existing = await prisma.patient.findFirst({
      where: { mobile: p.mobile, doctorId: doctor.id },
    });
    if (existing) {
      patients.push(existing);
    } else {
      const newP = await prisma.patient.create({
        data: {
          udid:             await generateUDID(hospitalA.shortCode),
          doctorId:         doctor.id,
          registeredAtId:   hospitalA.id,
          name:             p.name,
          age:              p.age,
          sex:              p.sex,
          mobile:           p.mobile,
          aadhaarEncrypted: encryptAadhaar("123456789012"),
          complaint:        p.complaint,
          category:         p.category as any,
        },
      });
      patients.push(newP);
    }
  }

  // ── Today's appointments with varied statuses & visit types ───────────────
  const schedule = [
    { patient: 0, time: today(9,  0), status: "COMPLETED", visitType: "General OPD",  hospital: hospitalA },
    { patient: 1, time: today(9, 15), status: "COMPLETED", visitType: "Follow-up",    hospital: hospitalA },
    { patient: 2, time: today(9, 30), status: "COMPLETED", visitType: "General OPD",  hospital: hospitalA },
    { patient: 3, time: today(9, 45), status: "COMPLETED", visitType: "Follow-up",    hospital: hospitalB },
    { patient: 6, time: today(10, 0), status: "COMPLETED", visitType: "Emergency",    hospital: hospitalA },
    { patient: 4, time: today(10,15), status: "CONFIRMED", visitType: "General OPD",  hospital: hospitalA },
    { patient: 5, time: today(10,30), status: "CONFIRMED", visitType: "Follow-up",    hospital: hospitalB },
    { patient: 7, time: today(10,45), status: "CONFIRMED", visitType: "Follow-up",    hospital: hospitalA },
    { patient: 8, time: today(11, 0), status: "CONFIRMED", visitType: "General OPD",  hospital: hospitalA },
    { patient: 9, time: today(11,15), status: "CONFIRMED", visitType: "Emergency",    hospital: hospitalA },
  ];

  const createdAppts: any[] = [];
  for (const s of schedule) {
    const appt = await prisma.appointment.create({
      data: {
        patientId:  patients[s.patient].id,
        doctorId:   doctor.id,
        hospitalId: s.hospital.id,
        dateTime:   s.time,
        status:     s.status as any,
        visitType:  s.visitType,
      },
    });
    createdAppts.push({ appt, patient: patients[s.patient], status: s.status });
  }

  // ── Create visits for COMPLETED appointments ──────────────────────────────
  for (const { appt, patient, status } of createdAppts) {
    if (status !== "COMPLETED") continue;
    const existing = await prisma.visit.findFirst({ where: { appointmentId: appt.id } });
    if (existing) continue;
    const visit = await prisma.visit.create({
      data: {
        patientId:     patient.id,
        doctorId:      doctor.id,
        hospitalId:    appt.hospitalId,
        appointmentId: appt.id,
        date:          new Date(now),
      },
    });
    await prisma.generalExamination.create({
      data: {
        visitId:         visit.id,
        bp:              "128/80",
        pulse:           "72",
        chiefComplaint:  patient.complaint ?? "Routine check",
        pastMedicalHistory: JSON.stringify(["DM"]),
      },
    });
    // Add a pending investigation for 2 of the completed visits
    if (patient.name === "Arjun Mehta" || patient.name === "Venkatesh Rao") {
      await prisma.investigationOrder.create({
        data: {
          visitId:  visit.id,
          testName: patient.name === "Arjun Mehta" ? "OCT Macula" : "Visual Field Test",
          category: "Imaging & Functional Tests",
          status:   "ORDERED",
        },
      });
    }
  }

  // ── Historical visits for analytics (past 7 days) ─────────────────────────
  for (let daysAgo = 1; daysAgo <= 6; daysAgo++) {
    const count = [5, 3, 6, 4, 7, 2][daysAgo - 1];
    for (let j = 0; j < count; j++) {
      const p = patients[j % patients.length];
      const d = past(daysAgo);
      d.setHours(9 + j, j * 10 % 60, 0, 0);
      const pastAppt = await prisma.appointment.create({
        data: {
          patientId:  p.id,
          doctorId:   doctor.id,
          hospitalId: hospitalA.id,
          dateTime:   d,
          status:     "COMPLETED",
          visitType:  j % 3 === 0 ? "Follow-up" : "General OPD",
        },
      });
      await prisma.visit.create({
        data: {
          patientId:     p.id,
          doctorId:      doctor.id,
          hospitalId:    hospitalA.id,
          appointmentId: pastAppt.id,
          date:          d,
        },
      });
    }
  }

  // ── IPD admissions ─────────────────────────────────────────────────────────
  const ipdCandidates = [
    { patient: patients[2], ward: "PRE_OP",   reason: "Pre-operative preparation",       daysAgo: 1 },
    { patient: patients[8], ward: "POST_OP",  reason: "Post cataract surgery recovery",  daysAgo: 3 },
    { patient: patients[3], ward: "GENERAL",  reason: "Diabetic retinopathy observation", daysAgo: 2 },
  ];

  for (const ipd of ipdCandidates) {
    const existingAdm = await prisma.admission.findFirst({
      where: { visit: { patientId: ipd.patient.id, doctorId: doctor.id } },
    });
    if (existingAdm) continue;

    const admDate = past(ipd.daysAgo);
    const admAppt = await prisma.appointment.create({
      data: {
        patientId:  ipd.patient.id,
        doctorId:   doctor.id,
        hospitalId: hospitalA.id,
        dateTime:   admDate,
        status:     "COMPLETED",
        visitType:  "Admission",
      },
    });
    const admVisit = await prisma.visit.create({
      data: {
        patientId:     ipd.patient.id,
        doctorId:      doctor.id,
        hospitalId:    hospitalA.id,
        appointmentId: admAppt.id,
        date:          admDate,
      },
    });
    await prisma.admission.create({
      data: {
        visitId:      admVisit.id,
        ward:         ipd.ward as any,
        reason:       ipd.reason,
        numberOfDays: ipd.daysAgo,
        createdAt:    admDate,
      },
    });
  }

  // ── Upcoming surgeries ─────────────────────────────────────────────────────
  const surgCandidates = [
    { patient: patients[2], daysOut: 2, type: "Phacoemulsification + IOL", re: true, le: false },
    { patient: patients[8], daysOut: 5, type: "SICS (Small Incision)",     re: false, le: true  },
  ];

  for (const s of surgCandidates) {
    const existing = await prisma.surgicalCounselling.findFirst({
      where: { visit: { patientId: s.patient.id, doctorId: doctor.id } },
    });
    if (existing) continue;

    const surgDate = new Date(now);
    surgDate.setDate(surgDate.getDate() + s.daysOut);
    surgDate.setHours(8, 0, 0, 0);

    const surgAppt = await prisma.appointment.create({
      data: {
        patientId:  s.patient.id,
        doctorId:   doctor.id,
        hospitalId: hospitalA.id,
        dateTime:   past(s.daysOut + 2),
        status:     "COMPLETED",
        visitType:  "Surgical Counselling",
      },
    });
    const surgVisit = await prisma.visit.create({
      data: {
        patientId:     s.patient.id,
        doctorId:      doctor.id,
        hospitalId:    hospitalA.id,
        appointmentId: surgAppt.id,
        date:          past(s.daysOut + 2),
      },
    });
    await prisma.surgicalCounselling.create({
      data: {
        visitId:         surgVisit.id,
        surgeryType:     s.type,
        surgeryDate:     surgDate,
        rightEye:        s.re,
        leftEye:         s.le,
        anaesthesiaType: "Local",
      },
    });
  }

  console.log("\n✅ Demo seed complete!");
  console.log("   Doctor login : doctor / password123");
  console.log("   Today's schedule : 10 appointments (5 completed, 5 waiting)");
  console.log("   IPD admissions   : 3 patients");
  console.log("   Upcoming surgeries: 2 (next 5 days)");
  console.log("   Pending investigations: 2");
  console.log("   7-day history    : 27 past visits\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
