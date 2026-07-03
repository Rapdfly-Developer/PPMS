"use client";

import { format } from "date-fns";

interface PrintProps {
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalContact?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  patientName?: string;
  patientUdid?: string;
  patientAge?: number | null;
  patientSex?: string;
  visitDate?: Date | string;
  visitType?: string;
}

export function PrintHeader({
  hospitalName = "Hospital Management System",
  hospitalAddress,
  hospitalContact,
  doctorName,
  doctorSpecialty = "Ophthalmologist",
  patientName,
  patientUdid,
  patientAge,
  patientSex,
  visitDate,
  visitType,
}: PrintProps) {
  const visitDateStr = visitDate
    ? format(new Date(visitDate), "dd MMM yyyy")
    : format(new Date(), "dd MMM yyyy");

  return (
    <div className="hidden print:block mb-4">
      {/* Hospital + Doctor row */}
      <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{hospitalName}</h1>
          {hospitalAddress && <p className="text-xs text-gray-600 mt-0.5">{hospitalAddress}</p>}
          {hospitalContact && <p className="text-xs text-gray-600">Contact: {hospitalContact}</p>}
        </div>
        {doctorName && (
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{doctorName}</p>
            <p className="text-xs text-gray-600">{doctorSpecialty}</p>
          </div>
        )}
      </div>

      {/* Patient strip */}
      {(patientName || patientUdid) && (
        <div className="flex items-center justify-between bg-gray-100 rounded px-3 py-2 text-xs">
          <div className="flex items-center gap-4">
            {patientName && <span className="font-semibold text-gray-900 text-sm">{patientName}</span>}
            {(patientAge != null || patientSex) && (
              <span className="text-gray-600">
                {patientAge != null ? `${patientAge}y` : ""}
                {patientAge != null && patientSex ? " / " : ""}
                {patientSex ? patientSex.charAt(0).toUpperCase() + patientSex.slice(1).toLowerCase() : ""}
              </span>
            )}
            {patientUdid && <span className="text-gray-500 font-mono">UHID: {patientUdid}</span>}
          </div>
          <div className="flex items-center gap-4 text-gray-600">
            {visitType && <span>{visitType}</span>}
            <span>Date: {visitDateStr}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PrintFooter({
  hospitalName,
  doctorName,
  doctorSpecialty = "Ophthalmologist",
}: Pick<PrintProps, "hospitalName" | "doctorName" | "doctorSpecialty">) {
  const printDate = format(new Date(), "dd MMM yyyy, h:mm a");

  return (
    <div className="hidden print:block mt-8 border-t border-gray-300 pt-4">
      <div className="flex items-end justify-between">
        <div className="text-center">
          <div className="w-40 border-b border-gray-400 mb-1" />
          <p className="text-xs text-gray-600">{doctorName ?? "Doctor's Signature"}</p>
          {doctorSpecialty && <p className="text-[10px] text-gray-500">{doctorSpecialty}</p>}
        </div>
        <div className="text-center text-[10px] text-gray-400 max-w-xs">
          <p>This is a computer-generated document.</p>
          <p>Valid only if authenticated by the treating physician.</p>
        </div>
        <div className="text-right text-[10px] text-gray-500">
          <p>Printed: {printDate}</p>
          {hospitalName && <p>{hospitalName}</p>}
        </div>
      </div>
    </div>
  );
}
