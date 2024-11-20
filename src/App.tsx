import React, { useEffect, useState, useCallback } from "react";
import FHIR from "fhirclient";
import axios from "axios";
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Stack,
  Text,
  Textarea,
  VStack,
  HStack,
  Spinner,
} from "@chakra-ui/react";
import { RiPlayLine, RiStopLine } from "react-icons/ri";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ReactMediaRecorder } from "react-media-recorder";

// Define the Patient interface
interface Patient {
  name?: { given?: string[]; family?: string }[];
  gender?: string;
  birthDate?: string;
}



function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDifference = today.getMonth() - birth.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) {
    age--; // 如果還沒到生日，年齡減 1
  }

  return age;
}

const App: React.FC = () => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prompt, setPrompt] = useState("Generate Medical Summary");
  const [apiKey, setApiKey] = useState("");
  const [asrText, setAsrText] = useState(""); // Editable ASR Text
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [gptResponse, setGptResponse] = useState(""); // Editable GPT Response
  const [isGenerating, setIsGenerating] = useState(false); // Spinner state for GPT generation
  const model = "gpt-4o"; // Fixed GPT model

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const client = await FHIR.oauth2.ready();
        const bundle = await client.request("Patient");
        if (bundle?.resourceType === "Bundle" && bundle?.entry?.length > 0) {
          const patientEntry = bundle.entry.find(
            (entry: any) => entry.resource.resourceType === "Patient"
          );
          if (patientEntry) {
            setPatient(patientEntry.resource as Patient);
          }
        }
      } catch (error) {
        console.error("Failed to fetch patient data:", error);
      }
    };
    fetchPatient();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timer!);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const handleWhisperRequest = useCallback(
    async (audioBlob: Blob) => {
      if (!apiKey) {
        alert("Please enter an API key.");
        return;
      }

      setIsLoading(true);

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", "whisper-1");

      try {
        const response = await axios.post(
          "https://api.openai.com/v1/audio/transcriptions",
          formData,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );
        setAsrText((prevText) => prevText + "\n" + response.data.text); // Append new ASR text
      } catch (error) {
        console.error("Failed to transcribe audio:", error);
        setAsrText((prevText) => prevText + "\nFailed to transcribe audio. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey]
  );

  const handleGptRequest = async () => {
    if (!apiKey) {
      alert("Please enter an API key.");
      return;
    }

    setIsGenerating(true); // Show spinner during GPT request

    // Combine Patient Info and ASR Content
    const patientInfo = patient
      ? `Patient Info:\nName: ${patient.name?.[0]?.given?.join(" ") || "N/A"} ${
          patient.name?.[0]?.family || "N/A"
        }\nGender: ${patient.gender || "N/A"}\nBirth Date: ${patient.birthDate || "N/A"}\n`
      : "No patient information available.\n";

    const fullPrompt = `${patientInfo}\nASR Content:\n${asrText}\n\n${prompt}`;

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [{ role: "user", content: fullPrompt }],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
      setGptResponse(response.data.choices[0]?.message?.content || "No response received");
    } catch (error) {
      console.error("Failed to generate GPT response:", error);
    } finally {
      setIsGenerating(false); // Hide spinner after request
    }
  };

  return (
    <ChakraProvider value={defaultSystem}>
      <Container maxW="container.lg" p={5}>
        <Heading as="h1" size="xl" mb={6} textAlign="center">
          SMART on FHIR App
        </Heading>

        <Stack>
          {/* Patient Info Section */}
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
            <Heading as="h2" size="md" mb={4}>
              Patient Info
            </Heading>
            {patient ? (
              <VStack align="start">
                <Text>
                  <strong>Name:</strong> {patient.name?.[0]?.given?.join(" ") || "N/A"}{" "}
                  {patient.name?.[0]?.family || "N/A"}
                </Text>
                <Text>
                  <strong>Gender:</strong> {patient.gender || "N/A"}
                </Text>
                <Text>
                <strong>Age:</strong> {patient.birthDate ? calculateAge(patient.birthDate) : "N/A"}
                </Text>
              </VStack>
            ) : (
              <Text>Loading patient data...</Text>
            )}
          </Box>

          {/* API Key Input Section */}
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
            <Heading as="h2" size="md" mb={4}>
              API Key
            </Heading>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your OpenAI API key"
            />
          </Box>

          {/* ASR Section */}
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
            <Heading as="h2" size="md" mb={4}>
              Audio Speech Recognition (ASR)
            </Heading>
            <ReactMediaRecorder
              audio
              onStop={async (blobUrl, blob) => {
                setIsLoading(true);
                setIsRecording(false);
                setRecordingTime(0);
                try {
                  await handleWhisperRequest(blob);
                } catch (error) {
                  console.error("Error in transcription:", error);
                }
                setIsLoading(false);
              }}
              render={({ startRecording, stopRecording }) => (
                <VStack align="start">
                  {isRecording ? (
                    <HStack>
                      <Button colorScheme="red" onClick={stopRecording}>
                        <RiStopLine /> Stop Recording
                      </Button>
                      <Text>{`Recording: ${recordingTime}s`}</Text>
                    </HStack>
                  ) : (
                    <Button
                      colorScheme="green"
                      onClick={() => {
                        if (!apiKey) {
                          alert("Please enter an API key.");
                          return;
                        }
                        startRecording();
                        setIsRecording(true);
                      }}
                    >
                      <RiPlayLine /> Start Recording
                    </Button>
                  )}
                  {isLoading && (
                    <HStack>
                      <Spinner size="md" />
                      <Text>Transcribing audio...</Text>
                    </HStack>
                  )}
                  <Textarea
                    value={asrText}
                    onChange={(e) => setAsrText(e.target.value)}
                    placeholder="ASR Text will appear here"
                    mt={4}
                  />
                </VStack>
              )}
            />
          </Box>

          {/* Prompt Section */}
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
            <Heading as="h2" size="md" mb={4}>
              Prompt
            </Heading>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here"
              mt={4}
            />
          </Box>

          {/* ChatGPT Section */}
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg">
            <Heading as="h2" size="md" mb={4}>
              ChatGPT
            </Heading>
            <Textarea
              value={gptResponse}
              onChange={(e) => setGptResponse(e.target.value)}
              placeholder="GPT response will appear here"
              mt={4}
            />
            <Button
              colorScheme="teal"
              mt={4}
              onClick={handleGptRequest}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <HStack>
                  <Spinner size="sm" />
                  <Text>Generating...</Text>
                </HStack>
              ) : (
                "Generate GPT Response"
              )}
            </Button>
          </Box>
        </Stack>
      </Container>
    </ChakraProvider>
  );
};

export default App;
