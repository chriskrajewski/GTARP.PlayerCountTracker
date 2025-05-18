"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Define types for feedback submission
type FeedbackType = 'bug' | 'feature' | 'feedback';

interface FeedbackData {
  title: string;
  description: string;
  type: FeedbackType;
  email: string;
  serverName: string;
}

interface ApiResponse {
  success: boolean;
  issueNumber?: number;
  issueUrl?: string;
  error?: string;
}

export default function FeedbackPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState<FeedbackData>({
    title: "",
    description: "",
    type: "feedback",
    email: "",
    serverName: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, type: value as FeedbackType }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      
      const data: ApiResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }
      
      setIsSuccess(true);
      setIssueUrl(data.issueUrl || null);
      toast.success("Feedback submitted successfully!");
      
      // Reset form after successful submission
      setTimeout(() => {
        if (!issueUrl) {
          // Navigate back to the homepage
          router.push('/');
        }
      }, 3000);
      
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Simple header with back button */}
      <div className="bg-[#0e0e10] p-4 flex items-center border-b border-[#26262c]">
        <Link href="/" className="mr-3">
          <ArrowLeft className="h-5 w-5 text-white" />
        </Link>
        <h1 className="text-base font-bold text-white">Send Feedback</h1>
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 bg-black">
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-[#0e0e10] p-6 rounded-lg border border-[#26262c] max-w-md w-full">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Thank You!</h2>
              <p className="text-gray-400 mb-6">Your feedback has been submitted successfully.</p>
              
              {issueUrl && (
                <a 
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#18181b] hover:bg-[#26262c] text-white p-3 mb-3 rounded-md transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  View GitHub Issue
                </a>
              )}
              
              <Link href="/">
                <Button className="w-full bg-[#004D61] hover:bg-[#003a4d] text-white">
                  Return to Home
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
            <div className="text-sm text-gray-400 mb-2">
              Submit a bug report, feature request, or general feedback.
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="feedbackType" className="text-sm text-white">Feedback Type</Label>
              <RadioGroup 
                value={formData.type} 
                onValueChange={handleTypeChange}
                className="flex flex-wrap gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bug" id="bug" />
                  <Label htmlFor="bug" className="text-sm text-white">Bug Report</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="feature" id="feature" />
                  <Label htmlFor="feature" className="text-sm text-white">Feature Request</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="feedback" id="feedback" />
                  <Label htmlFor="feedback" className="text-sm text-white">General Feedback</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="title" className="text-sm text-white">Title <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Brief summary of your feedback"
                required
                className="bg-[#18181b] border-[#26262c] text-white"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="description" className="text-sm text-white">Description <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Please provide details about your feedback"
                rows={6}
                required
                className="bg-[#18181b] border-[#26262c] text-white"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm text-white">Email (optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Your email for follow-up questions"
                className="bg-[#18181b] border-[#26262c] text-white"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="serverName" className="text-sm text-white">Server Name (optional)</Label>
              <Input
                id="serverName"
                name="serverName"
                value={formData.serverName}
                onChange={handleInputChange}
                placeholder="Which server does this feedback relate to?"
                className="bg-[#18181b] border-[#26262c] text-white"
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-[#004D61] hover:bg-[#003a4d] text-white h-10 mt-4"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
} 