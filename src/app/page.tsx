"use client";
import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { SendHorizonal, Upload } from "lucide-react";
import dotenv from "dotenv";
dotenv.config();

interface Message {
  id: number;
  sender: "user" | "ai";
  text: string;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function ChatbotUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>("");
  const [pdfText, setPdfText] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_API_KEY ;


  // Load pdf.js CDN
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    };
    document.body.appendChild(script);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const typedArray = new Uint8Array(reader.result as ArrayBuffer);
      const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      console.log("Parsed PDF content:\n", fullText);
      setPdfText(fullText.trim());
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt) return;

    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      text: prompt,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);

    const fullPrompt = `${prompt}\n\n${pdfText}`;

    const contents = updatedMessages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    // Append the prompt + parsed PDF as the last input
    contents.push({ role: "user", parts: [{ text: fullPrompt }] });

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contents }),
        }
      );

      const data = await response.json();
      const replyText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        "Sorry, I couldn't generate a response.";

      const aiMessage: Message = {
        id: Date.now() + 1,
        sender: "ai",
        text: replyText,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("API error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: "ai",
          text: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground dark p-4">
      <Card className="w-full max-w-2xl h-[80vh] flex flex-col rounded-2xl shadow-lg 
  bg-white/60 backdrop-blur-lg border border-white/20 text-black">
        <div className="border-b p-4 text-xl font-semibold text-center">
          My Chatbot
        </div>
        <CardContent className="flex-1 p-4 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4 flex flex-col">
              {messages.map((msg) => (
         <motion.div
  key={msg.id}
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
>
  <div
    className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap backdrop-blur-md shadow-md
      ${
        msg.sender === "user"
          ? "text-white bg-blue-600/40 rounded-br-none"
          : "text-white bg-gradient-to-br from-blue-400/40 via-purple-400/40 to-indigo-400/40 rounded-bl-none"
      }`}
  >
    {msg.text}
  </div>
</motion.div>


              ))}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-300 text-black px-4 py-2 rounded-2xl text-sm animate-pulse rounded-bl-none">
                    Typing...
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <div className="border-t p-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-input text-black dark:bg-input dark:text-foreground"
            />
            <Button onClick={handleSend} className="bg-primary text-primary-foreground">
              <SendHorizonal className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm"
            >
              <Upload className="w-4 h-4 mr-1" /> Upload PDF
            </Button>
            {fileName && (
              <span className="text-xs text-muted-foreground ml-2">
                1 file uploaded: {fileName}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}