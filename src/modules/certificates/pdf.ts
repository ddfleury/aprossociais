import "server-only";

import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getEnv } from "@/core/config/env";
import type { CertificateRow } from "@/modules/certificates/queries";

function safe(value: string): string {
  return value.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, "");
}
function center(
  pageWidth: number,
  font: { widthOfTextAtSize(text: string, size: number): number },
  text: string,
  size: number,
) {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2;
}

export async function createCertificatePdf(
  certificate: CertificateRow,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(certificate.title);
  pdf.setAuthor("APROS Sociais");
  pdf.setSubject(`Certificado de ${certificate.participant_name}`);
  pdf.setCreationDate(new Date());
  const page = pdf.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.035, 0.16, 0.28);
  const blue = rgb(0.08, 0.36, 0.65);
  const gold = rgb(0.79, 0.6, 0.18);
  const gray = rgb(0.32, 0.38, 0.47);
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: navy,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 29,
    y: 29,
    width: width - 58,
    height: height - 58,
    borderColor: gold,
    borderWidth: 1,
  });
  page.drawRectangle({
    x: 42,
    y: height - 106,
    width: width - 84,
    height: 48,
    color: navy,
  });
  page.drawText("APROS SOCIAIS", {
    x: 58,
    y: height - 88,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("PROGRAMAS SOCIAIS", {
    x: width - 235,
    y: height - 84,
    size: 10,
    font: bold,
    color: gold,
  });
  const heading = "CERTIFICADO";
  page.drawText(heading, {
    x: center(width, bold, heading, 34),
    y: height - 164,
    size: 34,
    font: bold,
    color: navy,
  });
  page.drawLine({
    start: { x: width / 2 - 95, y: height - 174 },
    end: { x: width / 2 + 95, y: height - 174 },
    thickness: 2,
    color: gold,
  });
  const intro = "Certificamos que";
  page.drawText(intro, {
    x: center(width, regular, intro, 13),
    y: height - 213,
    size: 13,
    font: regular,
    color: gray,
  });
  const name = safe(certificate.participant_name).slice(0, 80);
  const nameSize = name.length > 45 ? 25 : 30;
  page.drawText(name, {
    x: Math.max(50, center(width, bold, name, nameSize)),
    y: height - 255,
    size: nameSize,
    font: bold,
    color: blue,
  });
  const description = `participou de ${safe(certificate.title)}, vinculado ao programa ${safe(certificate.program_name)}, na unidade ${safe(certificate.unit_name)}.`;
  const words = description.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = `${current} ${word}`.trim();
    if (regular.widthOfTextAtSize(candidate, 13) > width - 170) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  lines.slice(0, 3).forEach((line, index) =>
    page.drawText(line, {
      x: center(width, regular, line, 13),
      y: height - 300 - index * 20,
      size: 13,
      font: regular,
      color: gray,
    }),
  );
  const issued = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: getEnv().APP_TIME_ZONE,
  }).format(new Date(`${certificate.issued_at.replace(" ", "T")}Z`));
  const workload = certificate.minutes
    ? `Carga horaria: ${Math.floor(certificate.minutes / 60)}h${certificate.minutes % 60 ? ` ${certificate.minutes % 60}min` : ""}`
    : "";
  page.drawText(workload, {
    x: center(width, bold, workload, 11),
    y: 205,
    size: 11,
    font: bold,
    color: navy,
  });
  page.drawText(`Emitido em ${issued}`, {
    x: center(width, regular, `Emitido em ${issued}`, 11),
    y: 184,
    size: 11,
    font: regular,
    color: gray,
  });
  page.drawLine({
    start: { x: 135, y: 112 },
    end: { x: 335, y: 112 },
    thickness: 1,
    color: gray,
  });
  page.drawLine({
    start: { x: 505, y: 112 },
    end: { x: 705, y: 112 },
    thickness: 1,
    color: gray,
  });
  page.drawText("Coordenacao do programa", {
    x: 165,
    y: 96,
    size: 10,
    font: regular,
    color: gray,
  });
  page.drawText("Direcao da APROS", {
    x: 560,
    y: 96,
    size: 10,
    font: regular,
    color: gray,
  });
  const verifyUrl = `${getEnv().APP_BASE_URL.replace(/\/$/, "")}/validar/${certificate.public_id}`;
  const dataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 170,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0A2947", light: "#FFFFFF" },
  });
  const qr = await pdf.embedPng(dataUrl);
  page.drawImage(qr, { x: width - 104, y: 39, width: 54, height: 54 });
  page.drawText(`Validacao: ${certificate.public_id}`, {
    x: 50,
    y: 52,
    size: 7.5,
    font: regular,
    color: gray,
  });
  page.drawText("Confira a autenticidade pelo QR Code", {
    x: 50,
    y: 40,
    size: 7.5,
    font: regular,
    color: gray,
  });
  return pdf.save();
}
