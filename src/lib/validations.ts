import { z } from "zod";

export const applicationFormSchema = z.object({
  // Applicant Information
  applicant_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  designation: z
    .string()
    .trim()
    .min(1, "Designation is required")
    .max(100, "Designation must be less than 100 characters"),
  contact_number: z
    .string()
    .trim()
    .min(10, "Contact number must be at least 10 digits")
    .max(15, "Contact number must be less than 15 digits")
    .regex(/^\d+$/, "Enter phone number without dashes"),
  applicant_email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  cnic: z
    .string()
    .trim()
    .min(13, "CNIC must be 13 digits")
    .max(15, "Invalid CNIC format")
    .regex(/^[\d-]+$/, "CNIC should only contain digits or dashes"),
  
  // Unit Information
  unit_id: z
    .string()
    .trim()
    .min(1, "Unit ID is required")
    .max(20, "Unit ID must be less than 20 characters"),
  unit_name: z
    .string()
    .trim()
    .min(1, "Unit name is required")
    .max(200, "Unit name must be less than 200 characters"),
  industry_address: z
    .string()
    .trim()
    .min(1, "Address is required")
    .max(500, "Address must be less than 500 characters"),
  district: z
    .string()
    .min(1, "Please select a district"),
  epa_action_date: z
    .string()
    .min(1, "Date of EPA action is required"),

  // Industry Information
  industry_category: z
    .string()
    .min(1, "Please select an industry category"),
  industry_subcategory: z
    .string()
    .min(1, "Please select an industry subcategory"),
  
  // Detail of Actions
  actions: z
    .array(z.string())
    .min(1, "Please select at least one action"),
});

export type ApplicationFormData = z.infer<typeof applicationFormSchema>;

export const trackingIdSchema = z.object({
  tracking_id: z
    .string()
    .trim()
    .min(1, "Tracking ID is required")
    .max(20, "Invalid tracking ID format"),
});

export type TrackingIdData = z.infer<typeof trackingIdSchema>;

const cnicSchema = z
  .string()
  .trim()
  .min(13, "CNIC must be 13 digits")
  .max(15, "Invalid CNIC format")
  .regex(/^[\d-]+$/, "CNIC should only contain digits or dashes");

export const loginSchema = z.object({
  cnic: cnicSchema,
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
});

export type LoginData = z.infer<typeof loginSchema>;

export const applicantMagicLinkSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
});

export type ApplicantMagicLinkData = z.infer<typeof applicantMagicLinkSchema>;
