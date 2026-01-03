"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, CheckCircle2, X, Bug, Lightbulb, MessageSquare, Sparkles, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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

// Animated gradient background for the form
const FormBackground = memo(function FormBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      <motion.div
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl opacity-20"
        style={{ 
          background: 'radial-gradient(circle, rgba(0, 217, 255, 0.2) 0%, transparent 70%)' 
        }}
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full blur-3xl opacity-15"
        style={{ 
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.2) 0%, transparent 70%)' 
        }}
        animate={{ 
          scale: [1.2, 1, 1.2],
          rotate: [0, -90, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  )
})

// Feedback type card component
const FeedbackTypeCard = memo(function FeedbackTypeCard({ 
  value, 
  label, 
  icon: Icon, 
  selected, 
  onSelect,
  color
}: { 
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  selected: boolean
  onSelect: (value: string) => void
  color: string
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(value)}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-300 ${
        selected 
          ? 'border-cyan-500/50 bg-cyan-500/10' 
          : 'border-[#26262c] bg-[#18181b]/50 hover:border-cyan-500/30'
      }`}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, transparent 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      <Icon className={`h-5 w-5 ${selected ? color : 'text-gray-400'}`} />
      <span className={`text-xs font-medium ${selected ? 'text-white' : 'text-gray-400'}`}>
        {label}
      </span>
      {selected && (
        <motion.div
          className="absolute -bottom-px left-1/4 right-1/4 h-0.5 rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0, 217, 255, 0.6), transparent)' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.button>
  )
})

// Animated input wrapper
const AnimatedInput = memo(function AnimatedInput({ 
  children, 
  delay = 0 
}: { 
  children: React.ReactNode
  delay?: number 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
})

export function FeedbackForm({ trigger, className }: FeedbackFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "feedback",
    email: "john@roleplay.gg",
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
          email: "john@roleplay.gg",
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
        email: "john@roleplay.gg",
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
    <form onSubmit={handleSubmit} className="space-y-4 mt-3 relative z-10">
      {/* Feedback Type Selection */}
      <AnimatedInput delay={0.1}>
        <Label className="text-xs text-gray-400 mb-2 block">Feedback Type</Label>
        <div className="grid grid-cols-3 gap-2">
          <FeedbackTypeCard
            value="bug"
            label="Bug Report"
            icon={Bug}
            selected={formData.type === "bug"}
            onSelect={handleTypeChange}
            color="text-red-400"
          />
          <FeedbackTypeCard
            value="feature"
            label="Feature"
            icon={Lightbulb}
            selected={formData.type === "feature"}
            onSelect={handleTypeChange}
            color="text-yellow-400"
          />
          <FeedbackTypeCard
            value="feedback"
            label="General"
            icon={MessageSquare}
            selected={formData.type === "feedback"}
            onSelect={handleTypeChange}
            color="text-cyan-400"
          />
        </div>
      </AnimatedInput>
      
      {/* Title Input */}
      <AnimatedInput delay={0.15}>
        <Label htmlFor="title" className="text-xs text-gray-400">
          Title <span className="text-red-400">*</span>
        </Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="Brief summary of your feedback"
          required
          className="mt-1.5 bg-[#18181b]/50 border-[#26262c] text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all"
        />
      </AnimatedInput>
      
      {/* Description Textarea */}
      <AnimatedInput delay={0.2}>
        <Label htmlFor="description" className="text-xs text-gray-400">
          Description <span className="text-red-400">*</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Please provide details about your feedback"
          rows={4}
          required
          className="mt-1.5 bg-[#18181b]/50 border-[#26262c] text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all resize-none"
        />
      </AnimatedInput>
      
      {/* Email Input */}
      <AnimatedInput delay={0.25}>
        <Label htmlFor="email" className="text-xs text-gray-400">Email (optional)</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="john@roleplay.gg"
          className="mt-1.5 bg-[#18181b]/50 border-[#26262c] text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all"
        />
      </AnimatedInput>
      
      {/* Server Name Input */}
      <AnimatedInput delay={0.3}>
        <Label htmlFor="serverName" className="text-xs text-gray-400">Server Name (optional)</Label>
        <Input
          id="serverName"
          name="serverName"
          value={formData.serverName}
          onChange={handleInputChange}
          placeholder="Which server does this feedback relate to?"
          className="mt-1.5 bg-[#18181b]/50 border-[#26262c] text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all"
        />
      </AnimatedInput>
      
      {/* Submit Button */}
      <AnimatedInput delay={0.35}>
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Button 
            type="submit" 
            disabled={isSubmitting || isSuccess}
            className="w-full mt-2"
            variant="cyber"
          >
            <AnimatePresence mode="wait">
              {isSubmitting ? (
                <motion.span
                  key="submitting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </motion.span>
              ) : isSuccess ? (
                <motion.span
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Submitted!
                </motion.span>
              ) : (
                <motion.span
                  key="submit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Submit Feedback
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </AnimatedInput>
    </form>
  );

  return (
    <>
      {CustomTrigger}
      
      {/* Desktop Dialog Version */}
      {!isMobile && (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent 
            className="sm:max-w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto border-cyan-500/20"
            style={{
              background: 'linear-gradient(135deg, rgba(14, 14, 16, 0.98) 0%, rgba(10, 10, 12, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <FormBackground />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                <span className="bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent">
                  Send Feedback
                </span>
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm">
                Submit a bug report, feature request, or general feedback.
              </DialogDescription>
            </DialogHeader>
            {FormContent}
          </DialogContent>
        </Dialog>
      )}
      
      {/* Mobile Full-Screen Version */}
      <AnimatePresence>
        {isMobile && mobileFormVisible && (
          <motion.div 
            className="fixed inset-0 z-[100] flex flex-col"
            style={{
              background: 'linear-gradient(180deg, rgba(10, 10, 12, 0.98) 0%, rgba(14, 14, 16, 0.98) 100%)',
            }}
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <FormBackground />
            
            {/* Header */}
            <motion.div 
              className="relative z-10 p-4 flex items-center justify-between border-b border-cyan-500/10"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Send Feedback</h2>
              </div>
              <motion.button 
                onClick={closeMobileForm} 
                className="p-2 rounded-lg bg-[#18181b]/80 text-white border border-[#26262c] hover:border-cyan-500/30 transition-all"
                disabled={isSubmitting}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </motion.div>
            
            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 relative z-10">
              <p className="text-xs text-gray-400 mb-4">
                Submit a bug report, feature request, or general feedback.
              </p>
              {FormContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FeedbackForm;
