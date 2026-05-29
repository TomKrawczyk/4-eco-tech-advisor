import React, { useMemo, useState } from "react";
import { Upload, Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SignaturePad from "@/components/shared/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creditFormInitialData } from "./financingData";

const fieldRows = [
  ["borrower_pesel", "coborrower_pesel", "Pesel"],
  ["borrower_name", "coborrower_name", "Imię i nazwisko"],
  ["borrower_id_number", "coborrower_id_number", "Seria i nr dowodu"],
  ["borrower_id_issue_date", "coborrower_id_issue_date", "Data wydania dowodu"],
  ["borrower_id_expiry_date", "coborrower_id_expiry_date", "Data ważności dowodu"],
  ["borrower_mother_maiden_name", "coborrower_mother_maiden_name", "Nazwisko rodowe mamy"],
  ["borrower_marital_status", "coborrower_marital_status", "Stan cywilny"],
  ["borrower_children_count", "coborrower_children_count", "Ilość dzieci na utrzymaniu do 18 lat"],
  ["borrower_children_birth_dates", "coborrower_children_birth_dates", "Daty urodzin dzieci"],
  ["borrower_phone", "coborrower_phone", "Nr telefonu"],
  ["borrower_email", "coborrower_email", "Adres mail"],
  ["borrower_education", "coborrower_education", "Wykształcenie"],
];

const addressSections = [
  {
    title: "Adres zamieszkania",
    fields: ["street", "postal", "city"],
    labels: ["Ulica / numer", "Kod pocztowy", "Miejscowość / Poczta"],
    prefix: "home",
  },
  {
    title: "Adres do korespondencji",
    fields: ["street", "postal", "city"],
    labels: ["Ulica / numer", "Kod pocztowy", "Miejscowość / Poczta"],
    prefix: "correspondence",
  },
  {
    title: "Adres montażu instalacji (jeśli dotyczy)",
    fields: ["street", "postal", "city"],
    labels: ["Ulica / numer", "Kod pocztowy", "Miejscowość / Poczta"],
    prefix: "installation",
  },
];

const incomeRows = [
  ["borrower_income_type", "coborrower_income_type", "Typ dochodu"],
  ["borrower_income_from", "coborrower_income_from", "Od kiedy"],
  ["borrower_income_to", "coborrower_income_to", "Do kiedy"],
  ["borrower_employer_nip", "coborrower_employer_nip", "NIP pracodawcy"],
  ["borrower_employer_name", "coborrower_employer_name", "Nazwa"],
  ["borrower_employer_phone", "coborrower_employer_phone", "Telefon"],
  ["borrower_position", "coborrower_position", "Stanowisko"],
];

function SmallField({ label, value, onChange, type = "text" }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      <Input type={type} value={value} onChange={onChange} className="h-9" />
    </div>
  );
}

function PersonColumn({ title, rows, formData, onFieldChange }) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {rows.map(([field, label, type]) => (
        <SmallField
          key={field}
          label={label}
          type={type || "text"}
          value={formData[field]}
          onChange={(e) => onFieldChange(field, e.target.value)}
        />
      ))}
    </div>
  );
}

export default function CreditApplicationTab() {
  const [formData, setFormData] = useState(creditFormInitialData);
  const printableDate = useMemo(() => new Date().toLocaleDateString("pl-PL"), []);

  const onFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImportPdf = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    window.open(fileUrl, "_blank");
  };

  const handleExportPdf = async () => {
    const element = document.getElementById("credit-application-print");
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= 297;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= 297;
    }

    pdf.save("wniosek-kredytowy.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Uniwersalny wniosek kredytowy</h2>
            <p className="text-sm text-gray-600">Uzupełnij dane, dodaj podpisy i wyeksportuj gotowy PDF.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex">
              <input type="file" accept="application/pdf" className="hidden" onChange={handleImportPdf} />
              <span className="inline-flex items-center justify-center gap-2 h-9 px-4 py-2 rounded-md border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground text-sm font-medium cursor-pointer">
                <Upload className="w-4 h-4" /> Import PDF
              </span>
            </label>
            <Button onClick={handleExportPdf} className="gap-2">
              <Download className="w-4 h-4" /> Eksport do PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SmallField label="Nazwa towaru" value={formData.product_name} onChange={(e) => onFieldChange("product_name", e.target.value)} />
          <SmallField label="Cena towaru" value={formData.product_price} onChange={(e) => onFieldChange("product_price", e.target.value)} />
          <SmallField label="Wpłata klienta" value={formData.client_contribution} onChange={(e) => onFieldChange("client_contribution", e.target.value)} />
          <SmallField label="Kwota do skredytowania" value={formData.financed_amount} onChange={(e) => onFieldChange("financed_amount", e.target.value)} />
          <SmallField label="Liczba rat" value={formData.installments_count} onChange={(e) => onFieldChange("installments_count", e.target.value)} />
          <SmallField label="Dzień płatności rat" value={formData.payment_day} onChange={(e) => onFieldChange("payment_day", e.target.value)} />
          <SmallField label="Nr kredytu" value={formData.credit_number} onChange={(e) => onFieldChange("credit_number", e.target.value)} />
          <SmallField label="Nazwa agencji / Nr w strukturach" value={formData.agency_name} onChange={(e) => onFieldChange("agency_name", e.target.value)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <PersonColumn
            title="Kredytobiorca"
            rows={[
              ["borrower_pesel", "Pesel"], ["borrower_name", "Imię i nazwisko"], ["borrower_id_number", "Seria i nr dowodu"],
              ["borrower_id_issue_date", "Data wydania dowodu", "date"], ["borrower_id_expiry_date", "Data ważności dowodu", "date"],
              ["borrower_mother_maiden_name", "Nazwisko rodowe mamy"], ["borrower_marital_status", "Stan cywilny"],
              ["borrower_children_count", "Ilość dzieci do 18 lat"], ["borrower_children_birth_dates", "Daty urodzin dzieci"],
              ["borrower_phone", "Nr telefonu"], ["borrower_email", "Adres mail", "email"], ["borrower_education", "Wykształcenie"],
              ["borrower_net_income", "Dochód netto"], ["borrower_monthly_expenses", "Wydatki miesięczne"],
              ["borrower_income_type", "Typ dochodu"], ["borrower_income_from", "Dochód od kiedy", "date"], ["borrower_income_to", "Dochód do kiedy", "date"],
              ["borrower_employer_nip", "NIP pracodawcy"], ["borrower_employer_name", "Nazwa pracodawcy"], ["borrower_employer_phone", "Telefon pracodawcy"], ["borrower_position", "Stanowisko"],
              ["borrower_home_street", "Adres zamieszkania - ulica / numer"], ["borrower_home_postal", "Adres zamieszkania - kod pocztowy"], ["borrower_home_city", "Adres zamieszkania - miejscowość / poczta"],
              ["borrower_correspondence_street", "Adres korespondencyjny - ulica / numer"], ["borrower_correspondence_postal", "Adres korespondencyjny - kod pocztowy"], ["borrower_correspondence_city", "Adres korespondencyjny - miejscowość / poczta"],
              ["borrower_installation_street", "Adres montażu - ulica / numer"], ["borrower_installation_postal", "Adres montażu - kod pocztowy"], ["borrower_installation_city", "Adres montażu - miejscowość / poczta"],
            ]}
            formData={formData}
            onFieldChange={onFieldChange}
          />
          <PersonColumn
            title="Współkredytobiorca"
            rows={[
              ["coborrower_pesel", "Pesel"], ["coborrower_name", "Imię i nazwisko"], ["coborrower_id_number", "Seria i nr dowodu"],
              ["coborrower_id_issue_date", "Data wydania dowodu", "date"], ["coborrower_id_expiry_date", "Data ważności dowodu", "date"],
              ["coborrower_mother_maiden_name", "Nazwisko rodowe mamy"], ["coborrower_marital_status", "Stan cywilny"],
              ["coborrower_children_count", "Ilość dzieci do 18 lat"], ["coborrower_children_birth_dates", "Daty urodzin dzieci"],
              ["coborrower_phone", "Nr telefonu"], ["coborrower_email", "Adres mail", "email"], ["coborrower_education", "Wykształcenie"],
              ["coborrower_net_income", "Dochód netto"], ["coborrower_monthly_expenses", "Wydatki miesięczne"],
              ["coborrower_income_type", "Typ dochodu"], ["coborrower_income_from", "Dochód od kiedy", "date"], ["coborrower_income_to", "Dochód do kiedy", "date"],
              ["coborrower_employer_nip", "NIP pracodawcy"], ["coborrower_employer_name", "Nazwa pracodawcy"], ["coborrower_employer_phone", "Telefon pracodawcy"], ["coborrower_position", "Stanowisko"],
              ["coborrower_home_street", "Adres zamieszkania - ulica / numer"], ["coborrower_home_postal", "Adres zamieszkania - kod pocztowy"], ["coborrower_home_city", "Adres zamieszkania - miejscowość / poczta"],
              ["coborrower_correspondence_street", "Adres korespondencyjny - ulica / numer"], ["coborrower_correspondence_postal", "Adres korespondencyjny - kod pocztowy"], ["coborrower_correspondence_city", "Adres korespondencyjny - miejscowość / poczta"],
              ["coborrower_installation_street", "Adres montażu - ulica / numer"], ["coborrower_installation_postal", "Adres montażu - kod pocztowy"], ["coborrower_installation_city", "Adres montażu - miejscowość / poczta"],
            ]}
            formData={formData}
            onFieldChange={onFieldChange}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SmallField label="Dochód netto kredytobiorcy" value={formData.borrower_net_income} onChange={(e) => onFieldChange("borrower_net_income", e.target.value)} />
          <SmallField label="Wydatki miesięczne kredytobiorcy" value={formData.borrower_monthly_expenses} onChange={(e) => onFieldChange("borrower_monthly_expenses", e.target.value)} />
          <SmallField label="Dochód netto współkredytobiorcy" value={formData.coborrower_net_income} onChange={(e) => onFieldChange("coborrower_net_income", e.target.value)} />
          <SmallField label="Wydatki miesięczne współkredytobiorcy" value={formData.coborrower_monthly_expenses} onChange={(e) => onFieldChange("coborrower_monthly_expenses", e.target.value)} />
          <SmallField label="Imię i nazwisko przedstawiciela" value={formData.representative_name} onChange={(e) => onFieldChange("representative_name", e.target.value)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SignaturePad value={formData.customer_signature} onChange={(value) => onFieldChange("customer_signature", value)} label="Podpis klienta / kredytobiorcy" />
          <SignaturePad value={formData.advisor_signature} onChange={(value) => onFieldChange("advisor_signature", value)} label="Podpis doradcy / sprzedawcy" />
        </div>
      </div>

      <div id="credit-application-print" className="bg-white rounded-2xl border border-gray-200 p-2 shadow-sm text-black">
        <div className="space-y-2 text-[9px] leading-tight">
          <h2 className="text-xl font-bold">Wniosek o KREDYT RATALNY</h2>

          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <div><span className="font-semibold">Nazwa towaru:</span> {formData.product_name}</div>
            <div><span className="font-semibold">Cena towaru:</span> {formData.product_price}</div>
            <div><span className="font-semibold">Wpłata klienta:</span> {formData.client_contribution}</div>
            <div><span className="font-semibold">Kwota do skredytowania:</span> {formData.financed_amount}</div>
            <div><span className="font-semibold">Liczba rat:</span> {formData.installments_count}</div>
            <div><span className="font-semibold">Dzień płatności rat:</span> {formData.payment_day}</div>
            <div><span className="font-semibold">Nr kredytu:</span> {formData.credit_number}</div>
            <div><span className="font-semibold">Nazwa agencji / Nr w strukturach:</span> {formData.agency_name}</div>
          </div>

          <div className="overflow-hidden border border-gray-300">
            <table className="w-full border-collapse text-[8px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-1 text-left">Dane do kredytu</th>
                  <th className="border border-gray-300 p-1 text-left">Kredytobiorca</th>
                  <th className="border border-gray-300 p-1 text-left">Współkredytobiorca</th>
                </tr>
              </thead>
              <tbody>
                {fieldRows.map(([borrowerField, coborrowerField, label]) => (
                  <tr key={label}>
                    <td className="border border-gray-300 p-1 font-medium">{label}</td>
                    <td className="border border-gray-300 p-1">{formData[borrowerField]}</td>
                    <td className="border border-gray-300 p-1">{formData[coborrowerField]}</td>
                  </tr>
                ))}
                {addressSections.map((section) => (
                  <tr key={section.title}>
                    <td className="border border-gray-300 p-1 font-medium align-top text-[7px]">{section.title}</td>
                    <td className="border border-gray-300 p-1">
                      {section.labels.map((label, index) => (
                        <div key={label}><span className="font-medium">{label}:</span> {formData[`coborrower_${section.prefix}_${section.fields[index]}`]}</div>
                      ))}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="border border-gray-300 p-1 font-medium align-top text-[7px]">Źródło dochodów</td>
                  <td className="border border-gray-300 p-1">
                    {incomeRows.map(([field, , label]) => <div key={field}><span className="font-medium">{label}:</span> {formData[field]}</div>)}
                  </td>
                  <td className="border border-gray-300 p-1">
                    {incomeRows.map(([, field, label]) => <div key={field}><span className="font-medium">{label}:</span> {formData[field]}</div>)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-1 font-medium">Dochód netto</td>
                  <td className="border border-gray-300 p-1">{formData.borrower_net_income}</td>
                  <td className="border border-gray-300 p-1">{formData.coborrower_net_income}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-1 font-medium">Wydatki (mies.)</td>
                  <td className="border border-gray-300 p-1">{formData.borrower_monthly_expenses}</td>
                  <td className="border border-gray-300 p-1">{formData.coborrower_monthly_expenses}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-1 font-medium">IMIĘ I NAZWISKO Przedstawiciela</td>
                  <td className="border border-gray-300 p-1" colSpan={2}>{formData.representative_name}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-[8px] space-y-1">
            <p>
              Wyrażam zgodę na przetwarzanie moich danych osobowych, zawartych w powyższym wniosku o kredyt ratalny przez 4 ECO spółka z ograniczoną odpowiedzialnością w celu złożenia przeze mnie wniosku i przekazania danych do banków współpracujących ze spółką 4 ECO.
            </p>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>Sprawdzenie zdolności kredytowej i złożenie wniosku kredytowego w jednym z banków współpracujących z 4 ECO sp. z o.o.</li>
              <li>Podpisanie wniosku oraz umowy kredytowej w procesie paperless.</li>
              <li>Pełny obowiązek informacyjny: https://4-eco.pl/rodo.</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="text-center">
              {formData.advisor_signature ? <img src={formData.advisor_signature} alt="Podpis doradcy" className="h-12 mx-auto object-contain" /> : <div className="h-12" />}
              <div className="border-t border-gray-400 pt-1 text-[7px]">Data i podpis Sprzedawcy</div>
            </div>
            <div className="text-center">
              {formData.customer_signature ? <img src={formData.customer_signature} alt="Podpis klienta" className="h-12 mx-auto object-contain" /> : <div className="h-12" />}
              <div className="border-t border-gray-400 pt-1 text-[7px]">Data i podpis Kredytobiorcy</div>
            </div>
          </div>

          <div className="text-right text-xs text-gray-500">Data wygenerowania: {printableDate}</div>
        </div>
      </div>
    </div>
  );
}