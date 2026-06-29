import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptAadhaar } from "../src/lib/crypto";
import { generateUDID } from "../src/lib/udid";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // Doctor
  const doctorUser = await prisma.user.create({
    data: { username: "doctor", passwordHash, role: "DOCTOR", email: "doctor@ppms.local" },
  });
  const doctor = await prisma.doctor.create({
    data: { userId: doctorUser.id, name: "Sai Dharshan", contact: "+91-98765-43210", credentials: "MS Ophthalmology" },
  });

  // Hospitals
  const hospitalA = await prisma.hospital.create({
    data: { name: "Sunrise Eye Hospital", shortCode: "SEH", address: "MG Road, Bengaluru", contact: "080-1234-5678" },
  });
  const hospitalB = await prisma.hospital.create({
    data: { name: "Lakeview Multispecialty Hospital", shortCode: "LMH", address: "HSR Layout, Bengaluru", contact: "080-8765-4321" },
  });

  await prisma.doctorHospitalLink.createMany({
    data: [
      { doctorId: doctor.id, hospitalId: hospitalA.id },
      { doctorId: doctor.id, hospitalId: hospitalB.id },
    ],
  });

  // Hospital staff logins
  const hospitalAUser = await prisma.user.create({ data: { username: "hospital_a", passwordHash, role: "HOSPITAL", email: "sunrise.frontdesk@ppms.local" } });
  await prisma.hospitalStaff.create({ data: { userId: hospitalAUser.id, hospitalId: hospitalA.id, name: "Sunrise Front Desk" } });

  const hospitalBUser = await prisma.user.create({ data: { username: "hospital_b", passwordHash, role: "HOSPITAL", email: "lakeview.frontdesk@ppms.local" } });
  await prisma.hospitalStaff.create({ data: { userId: hospitalBUser.id, hospitalId: hospitalB.id, name: "Lakeview Front Desk" } });

  // Refractionist
  const refUser = await prisma.user.create({ data: { username: "refractionist_a", passwordHash, role: "REFRACTIONIST", email: "priya.menon@ppms.local" } });
  await prisma.refractionist.create({
    data: { userId: refUser.id, name: "Priya Menon", doctorId: doctor.id, hospitalId: hospitalA.id },
  });

  // Doctor availability
  await prisma.doctorAvailability.createMany({
    data: [
      { doctorId: doctor.id, hospitalId: hospitalA.id, weekday: 1, startTime: "16:00", endTime: "19:00", slotMins: 15 },
      { doctorId: doctor.id, hospitalId: hospitalA.id, weekday: 4, startTime: "16:00", endTime: "19:00", slotMins: 15 },
      { doctorId: doctor.id, hospitalId: hospitalB.id, weekday: 2, startTime: "10:00", endTime: "13:00", slotMins: 15 },
    ],
  });

  // Patients
  const patientNames = [
    { name: "Ramesh Kumar", age: 62, sex: "MALE", mobile: "9000000001", complaint: "Blurred distance vision, both eyes" },
    { name: "Lakshmi Iyer", age: 54, sex: "FEMALE", mobile: "9000000002", complaint: "Watering and redness, left eye" },
    { name: "Suresh Babu", age: 70, sex: "MALE", mobile: "9000000003", complaint: "Gradual vision loss, suspect cataract" },
    { name: "Fathima Beevi", age: 45, sex: "FEMALE", mobile: "9000000004", complaint: "Routine diabetic eye check" },
  ];

  const patients = [];
  for (const p of patientNames) {
    const patient = await prisma.patient.create({
      data: {
        udid: await generateUDID(hospitalA.shortCode),
        doctorId: doctor.id,
        registeredAtId: hospitalA.id,
        name: p.name,
        age: p.age,
        sex: p.sex,
        mobile: p.mobile,
        aadhaarEncrypted: encryptAadhaar("123456789012"),
        complaint: p.complaint,
      },
    });
    patients.push(patient);
  }

  const today = new Date();
  today.setHours(16, 0, 0, 0);

  for (let i = 0; i < patients.length; i++) {
    const appt = await prisma.appointment.create({
      data: {
        patientId: patients[i].id,
        doctorId: doctor.id,
        hospitalId: i % 2 === 0 ? hospitalA.id : hospitalB.id,
        dateTime: new Date(today.getTime() + i * 15 * 60000),
        status: i === 0 ? "CONFIRMED" : "REQUESTED",
      },
    });

    if (i === 0) {
      const visit = await prisma.visit.create({
        data: {
          patientId: patients[i].id,
          doctorId: doctor.id,
          hospitalId: appt.hospitalId,
          appointmentId: appt.id,
          date: new Date(today.getTime() - 30 * 24 * 3600 * 1000),
        },
      });
      await prisma.generalExamination.create({
        data: {
          visitId: visit.id,
          bp: "130/82",
          pulse: "76",
          chiefComplaint: patients[i].complaint ?? "",
          pastMedicalHistory: JSON.stringify(["HTN", "DM"]),
        },
      });
      await prisma.iOPReading.create({ data: { visitId: visit.id, re: 16, le: 17, method: "NCT" } });
    }
  }

  console.log("Seed complete.");
  console.log("Doctor:", doctorUser.username);
  console.log("Hospital A staff:", hospitalAUser.username);
  console.log("Hospital B staff:", hospitalBUser.username);
  console.log("Refractionist:", refUser.username);
  console.log("Password for all:", "password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
