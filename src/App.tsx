import React, { useEffect, useState } from "react";
import FHIR from "fhirclient";
import axios from "axios";

const App: React.FC = () => {
  const [patient, setPatient] = useState<any>(null);
  const [summary, setSummary] = useState<string>("");

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const client = await FHIR.oauth2.ready();
        const bundle = await client.request("Patient");

        console.log("Fetched Bundle Data:", bundle);

        // 檢查是否為 FHIR Bundle 並且包含 entry
        if (bundle?.resourceType === "Bundle" && bundle?.entry?.length > 0) {
          // 從 entry 中提取第一個 Patient 資源
          const patientEntry = bundle.entry.find((entry: any) => entry.resource.resourceType === "Patient");
          if (patientEntry) {
            setPatient(patientEntry.resource);
          } else {
            console.error("No Patient resource found in bundle");
          }
        } else {
          console.error("Invalid FHIR bundle or no entries found");
        }
      } catch (error) {
        console.error("Failed to fetch patient data:", error);
      }
    };
    fetchPatient();
  }, []);

  const generateSummary = async () => {
    if (patient) {
      try {
        const name =
          patient?.name?.[0]?.given?.join(" ") +
          (patient?.name?.[0]?.family ? " " + patient?.name?.[0]?.family : "");
        const response = await axios.post("http://127.0.0.1:8000/generate-summary", {
          name: name || "Unknown",
          gender: patient.gender || "Unknown",
          birth_date: patient.birthDate || "Unknown",
        });
        setSummary(response.data.summary);
      } catch (error) {
        console.error("Failed to generate summary:", error);
      }
    }
  };

  return (
    <div>
      <h1>SMART on FHIR App</h1>
      {patient ? (
        <div>
          <h2>Patient Data</h2>
          <p>
            Name: {patient?.name?.[0]?.given?.join(" ") || "N/A"}{" "}
            {patient?.name?.[0]?.family || "N/A"}
          </p>
          <p>Gender: {patient.gender || "N/A"}</p>
          <p>Birth Date: {patient.birthDate || "N/A"}</p>
          <button onClick={generateSummary}>Generate Medical Summary</button>
          {summary && (
            <div>
              <h3>Medical Summary</h3>
              <p>{summary}</p>
            </div>
          )}
        </div>
      ) : (
        <p>Loading patient data...</p>
      )}
    </div>
  );
};

export default App;
