"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";

interface FeedbackFormProps {
  trigger?: React.ReactNode;
  className?: string;
}

export function FeedbackForm({ trigger, className }: FeedbackFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "feedback",
    email: "",
    serverName: ""
  });
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileFormVisible, setMobileFormVisible] = useState(false);

  // Check if we're on a mobile device on mount
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, type: value }));
  };

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen && !isSubmitting) {
      resetForm();
    }
  }, [isSubmitting]);

  const handleTriggerClick = useCallback(() => {
    if (isMobile) {
      // For mobile, show the full-page form
      setMobileFormVisible(true);
      // Prevent scrolling on the body when mobile form is open
      document.body.style.overflow = 'hidden';
    } else {
      // For desktop, use the dialog
      setOpen(true);
    }
  }, [isMobile]);

  const closeMobileForm = useCallback(() => {
    if (!isSubmitting) {
      setMobileFormVisible(false);
      resetForm();
      // Restore scrolling
      document.body.style.overflow = '';
    }
  }, [isSubmitting]);

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
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }
      
      setIsSuccess(true);
      toast.success("Feedback submitted successfully!");
      
      // Reset form after successful submission
      setTimeout(() => {
        setFormData({
          title: "",
          description: "",
          type: "feedback",
          email: "",
          serverName: ""
        });
        setIsSuccess(false);
        setOpen(false);
        setMobileFormVisible(false);
        // Restore scrolling
        document.body.style.overflow = '';
      }, 2000);
      
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    if (!isSubmitting) {
      setFormData({
        title: "",
        description: "",
        type: "feedback",
        email: "",
        serverName: ""
      });
      setIsSuccess(false);
    }
  };

  const CustomTrigger = trigger ? (
    <div onClick={handleTriggerClick}>
      {trigger}
    </div>
  ) : (
    <Button variant="outline" className={className} onClick={handleTriggerClick}>
      Provide Feedback
    </Button>
  );

  // Form content shared between desktop and mobile versions
  const FormContent = (
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 mt-2">
      <div className="space-y-1 sm:space-y-1.5">
        <Label htmlFor="feedbackType" className="text-xs sm:text-sm">Feedback Type</Label>
        <RadioGroup 
          value={formData.type} 
          onValueChange={handleTypeChange}
          className="flex flex-wrap gap-3 sm:space-x-4"
        >
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <RadioGroupItem value="bug" id="bug" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <Label htmlFor="bug" className="text-xs sm:text-sm">Bug Report</Label>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <RadioGroupItem value="feature" id="feature" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <Label htmlFor="feature" className="text-xs sm:text-sm">Feature Request</Label>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <RadioGroupItem value="feedback" id="feedback" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <Label htmlFor="feedback" className="text-xs sm:text-sm">General Feedback</Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="space-y-1 sm:space-y-1.5">
        <Label htmlFor="title" className="text-xs sm:text-sm">Title <span className="text-red-500">*</span></Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="Brief summary of your feedback"
          required
          className="text-xs sm:text-sm h-8 sm:h-9"
        />
      </div>
      
      <div className="space-y-1 sm:space-y-1.5">
        <Label htmlFor="description" className="text-xs sm:text-sm">Description <span className="text-red-500">*</span></Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Please provide details about your feedback"
          rows={4}
          required
          className="text-xs sm:text-sm"
        />
      </div>
      
      <div className="space-y-1 sm:space-y-1.5">
        <Label htmlFor="email" className="text-xs sm:text-sm">Email (optional)</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="Your email for follow-up questions"
          className="text-xs sm:text-sm h-8 sm:h-9"
        />
      </div>
      
      <div className="space-y-1 sm:space-y-1.5">
        <Label htmlFor="serverName" className="text-xs sm:text-sm">Server Name (optional)</Label>
        <Input
          id="serverName"
          name="serverName"
          value={formData.serverName}
          onChange={handleInputChange}
          placeholder="Which server does this feedback relate to?"
          className="text-xs sm:text-sm h-8 sm:h-9"
        />
      </div>
      
      <div className="mt-4">
        <Button 
          type="submit" 
          disabled={isSubmitting || isSuccess}
          className="w-full text-xs sm:text-sm h-8 sm:h-9"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
              Submitting...
            </>
          ) : isSuccess ? (
            <>
              <CheckCircle2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Submitted!
            </>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      {CustomTrigger}
      
      {/* Desktop Dialog Version */}
      {!isMobile && (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Send Feedback</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Submit a bug report, feature request, or general feedback.
              </DialogDescription>
            </DialogHeader>
            {FormContent}
          </DialogContent>
        </Dialog>
      )}
      
      {/* Mobile Full-Screen Version */}
      {isMobile && mobileFormVisible && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="bg-[#0e0e10] p-4 flex items-center justify-between border-b border-[#26262c]">
            <h2 className="text-base font-semibold text-white">Send Feedback</h2>
            <button 
              onClick={closeMobileForm} 
              className="p-1.5 rounded-full bg-[#18181b] text-white"
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-[#0e0e10]">
            <p className="text-xs text-gray-400 mb-4">
              Submit a bug report, feature request, or general feedback.
            </p>
            {FormContent}
          </div>
        </div>
      )}
    </>
  );
}

export default FeedbackForm; 