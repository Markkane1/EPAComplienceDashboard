import { useEffect, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { applicationFormSchema, ApplicationFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, Loader2, Copy, Download, X, FileText, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Application, ApplicationDocument } from "@/types/models";
import { useSearchParams } from "react-router-dom";

const SAMPLE_DOCUMENTS = {
  application: {
    label: "Sample for Application",
    url: "https://epd.punjab.gov.pk/system/files/Format%20of%20Application%20under%20Rule%2012(4)-22-07-25.pdf",
  },
  affidavit: {
    label: "Sample for Affidavit",
    url: "https://epd.punjab.gov.pk/system/files/Format%20for%20Affidavit%20-%20Reg12(4)%20SmogRules%202023-22-07-25.pdf",
  },
  undertaking: {
    label: "Sample for Undertaking",
    url: "https://epd.punjab.gov.pk/system/files/Format%20for%20undertaking-22-07-25.pdf",
  },
};

const DISTRICTS = [
  "Bahawalpur",
  "Bahawalnagar",
  "Rahim Yar Khan",
  "Dera Ghazi Khan",
  "Muzaffargarh",
  "Rajanpur",
  "Layyah",
  "Faisalabad",
  "Chiniot",
  "Jhang",
  "Toba Tek Singh",
  "Gujranwala",
  "Narowal",
  "Sialkot",
  "Gujrat",
  "Mandi Bahauddin",
  "Hafizabad",
  "Wazirabad",
  "Lahore",
  "Kasur",
  "Nankana Sahib",
  "Sheikhupura",
  "Multan",
  "Khanewal",
  "Lodhran",
  "Vehari",
  "Rawalpindi",
  "Attock",
  "Chakwal",
  "Jhelum",
  "Mianwali",
  "Sahiwal",
  "Okara",
  "Pakpattan",
  "Sargodha",
  "Bhakkar",
  "Khushab",
];

const EPA_ACTIONS = [
  "Immediate stoppage of pollution causing activity",
  "Suspension of any work",
  "Sealing the premises involved in commission of violations",
  "Seizure of the goods",
  "Issuance of any other directions for taking corrective measures",
  "Impounding of vehicles or taken into custody of goods",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["application/pdf"];

interface DocumentUpload {
  file: File | null;
  name: string;
}

interface UploadedDocument {
  type: "application" | "affidavit" | "undertaking";
  name: string;
  url: string;
}

const DOCUMENT_LABELS: Record<UploadedDocument["type"], string> = {
  application: "Application",
  affidavit: "Affidavit",
  undertaking: "Undertaking",
};

const parseDescription = (description: Application["description"]) => {
  if (!description) return null;
  if (typeof description === "string") {
    try {
      return JSON.parse(description) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof description === "object") {
    return description as Record<string, unknown>;
  }
  return null;
};

export function ApplicationForm() {
  const { user, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTrackingId, setSubmittedTrackingId] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [existingApplications, setExistingApplications] = useState<Application[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState("");
  const [existingDocuments, setExistingDocuments] = useState<ApplicationDocument[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [lastSubmitWasUpdate, setLastSubmitWasUpdate] = useState(false);
  const [pendingSubcategory, setPendingSubcategory] = useState<string>("");
  const [documents, setDocuments] = useState<{
    application: DocumentUpload;
    affidavit: DocumentUpload;
    undertaking: DocumentUpload;
  }>({
    application: { file: null, name: "" },
    affidavit: { file: null, name: "" },
    undertaking: { file: null, name: "" },
  });

  const applicationInputRef = useRef<HTMLInputElement>(null);
  const affidavitInputRef = useRef<HTMLInputElement>(null);
  const undertakingInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      applicant_name: "",
      designation: "",
      contact_number: "",
      applicant_email: "",
      cnic: "",
      unit_id: "",
      unit_name: "",
      industry_address: "",
      district: "",
      epa_action_date: "",
      industry_category: "",
      industry_subcategory: "",
      actions: [],
    },
  });

  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; subcategories: Array<{ id: string; name: string }> }>
  >([]);
  const selectedCategory = form.watch("industry_category");
  const availableSubcategories = useMemo(() => {
    const match = categories.find((category) => category.name === selectedCategory);
    return match?.subcategories ?? [];
  }, [categories, selectedCategory]);

  const isApplicant = hasRole("applicant");
  const isEditing = Boolean(selectedExistingId);

  useEffect(() => {
    let isMounted = true;
    const loadCategories = async () => {
      try {
        const data = await apiGet("/api/categories");
        if (isMounted) {
          setCategories(data || []);
        }
      } catch (error) {
        console.error("Load categories error:", error);
        if (isMounted) {
          setCategories([]);
        }
      }
    };
    loadCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isApplicant || !user) {
      setExistingApplications([]);
      return;
    }
    let isMounted = true;
    const loadIncomplete = async () => {
      setLoadingExisting(true);
      try {
        const data = await apiGet("/api/applications?status=incomplete");
        if (!isMounted) return;
        setExistingApplications(Array.isArray(data) ? data : data?.items || []);
      } catch (error) {
        console.error("Load incomplete applications error:", error);
        if (isMounted) {
          setExistingApplications([]);
        }
      } finally {
        if (isMounted) {
          setLoadingExisting(false);
        }
      }
    };
    loadIncomplete();
    return () => {
      isMounted = false;
    };
  }, [isApplicant, user]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !existingApplications.length) return;
    const match = existingApplications.find((app) => app.id === editId);
    if (match) {
      setSelectedExistingId(editId);
    }
  }, [existingApplications, searchParams]);

  useEffect(() => {
    if (!selectedExistingId) {
      setExistingDocuments([]);
      setSearchParams((prev) => {
        if (!prev.get("edit")) return prev;
        const next = new URLSearchParams(prev);
        next.delete("edit");
        return next;
      });
      return;
    }

    let isMounted = true;
    const loadExisting = async () => {
      try {
        const [app, docs] = await Promise.all([
          apiGet(`/api/applications/${selectedExistingId}`),
          apiGet(`/api/applications/${selectedExistingId}/documents`),
        ]);
        if (!isMounted) return;

        const description = parseDescription(app.description) as Record<string, unknown> | null;
        const nextValues = {
          applicant_name: app.applicant_name || "",
          designation: String(description?.designation || ""),
          contact_number: app.applicant_phone || "",
          applicant_email: app.applicant_email || "",
          cnic: String(description?.cnic || ""),
          unit_id: String(description?.unit_id || ""),
          unit_name: app.company_name || "",
          industry_address: app.company_address || "",
          district: String(description?.district || ""),
          epa_action_date: String(description?.epa_action_date || ""),
          industry_category: String(description?.industry_category || ""),
          industry_subcategory: String(description?.industry_subcategory || ""),
          actions: Array.isArray(description?.actions) ? (description?.actions as string[]) : [],
        };
        form.reset(nextValues);
        setPendingSubcategory(nextValues.industry_subcategory || "");

        setExistingDocuments(docs || []);
      } catch (error) {
        console.error("Load selected application error:", error);
        if (isMounted) {
          setSelectedExistingId("");
          setExistingDocuments([]);
        }
      }
    };
    loadExisting();
    return () => {
      isMounted = false;
    };
  }, [selectedExistingId, form]);

  useEffect(() => {
    if (!pendingSubcategory) return;
    if (!availableSubcategories.length) return;
    const isValid = availableSubcategories.some((sub) => sub.name === pendingSubcategory);
    if (isValid) {
      form.setValue("industry_subcategory", pendingSubcategory);
      setPendingSubcategory("");
    }
  }, [availableSubcategories, pendingSubcategory, form]);

  useEffect(() => {
    if (!selectedExistingId) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("edit", selectedExistingId);
      return next;
    });
  }, [selectedExistingId, setSearchParams]);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: "application" | "affidavit" | "undertaking"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large. Maximum size is 10MB.");
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error("Only PDF files are allowed.");
      return;
    }

    setDocuments((prev) => ({
      ...prev,
      [docType]: { file, name: file.name },
    }));
  };

  const removeDocument = (docType: "application" | "affidavit" | "undertaking") => {
    setDocuments((prev) => ({
      ...prev,
      [docType]: { file: null, name: "" },
    }));
    
    const inputRef = docType === "application" 
      ? applicationInputRef 
      : docType === "affidavit" 
        ? affidavitInputRef 
        : undertakingInputRef;
    
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const uploadDocuments = async (applicationId: string) => {
    const docTypes: Array<"application" | "affidavit" | "undertaking"> = [
      "application",
      "affidavit",
      "undertaking",
    ];

    const uploads = docTypes.map(async (docType) => {
      const doc = documents[docType];
      if (!doc.file) return null;

      const formData = new FormData();
      formData.append("file", doc.file);
      formData.append("doc_type", docType);

      const uploaded = await apiPost(`/api/applications/${applicationId}/documents`, formData);

      return {
        type: docType,
        name: doc.name,
        url: uploaded.file_url,
      } satisfies UploadedDocument;
    });

    const results = await Promise.all(uploads);
    return results.filter(Boolean) as UploadedDocument[];
  };

  const onSubmit = async (data: ApplicationFormData) => {
    if (!isEditing) {
      if (!documents.application.file) {
        toast.error("Please upload the Application document.");
        return;
      }
      if (!documents.affidavit.file) {
        toast.error("Please upload the Affidavit document.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = data.applicant_email
        .replace(/[^\x20-\x7E]/g, "")
        .trim()
        .toLowerCase();

      const payload = {
        applicant_name: data.applicant_name,
        applicant_email: normalizedEmail,
        applicant_phone: data.contact_number,
        company_name: data.unit_name,
        company_address: data.industry_address,
        application_type: "Compliance of Standards",
        description: {
          designation: data.designation,
          cnic: data.cnic,
          unit_id: data.unit_id,
          district: data.district,
          epa_action_date: data.epa_action_date,
          industry_category: data.industry_category,
          industry_subcategory: data.industry_subcategory,
          actions: data.actions,
        },
      };

      const application = isEditing
        ? await apiPut(`/api/applications/${selectedExistingId}`, payload)
        : await apiPost("/api/applications", payload);

      const hasDocuments =
        documents.application.file || documents.affidavit.file || documents.undertaking.file;
      const uploaded = hasDocuments ? await uploadDocuments(application.id) : [];
      setUploadedDocuments(uploaded);

      setSubmittedTrackingId(application.tracking_id);
      setLastSubmitWasUpdate(isEditing);
      toast.success(isEditing ? "Application updated successfully!" : "Application submitted successfully!");
      if (isEditing) {
        setExistingApplications((prev) => prev.filter((app) => app.id !== selectedExistingId));
        setSelectedExistingId("");
        setExistingDocuments([]);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete("edit");
          return next;
        });
      }
    } catch (error: unknown) {
      console.error("Submission error:", error);
      toast.error(isEditing ? "Failed to update application. Please try again later." : "Failed to submit application. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTrackingId = () => {
    if (submittedTrackingId) {
      navigator.clipboard.writeText(submittedTrackingId);
      toast.success("Tracking ID copied to clipboard");
    }
  };

  const resetForm = () => {
    form.reset();
    setDocuments({
      application: { file: null, name: "" },
      affidavit: { file: null, name: "" },
      undertaking: { file: null, name: "" },
    });
    setSubmittedTrackingId(null);
    setUploadedDocuments([]);
    setSelectedExistingId("");
    setExistingDocuments([]);
    setLastSubmitWasUpdate(false);
  };

  if (submittedTrackingId) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-accent mx-auto" />
            <h2 className="text-2xl font-bold">
              {lastSubmitWasUpdate ? "Application Updated!" : "Application Submitted!"}
            </h2>
            <p className="text-muted-foreground">
              {lastSubmitWasUpdate
                ? "Your application has been updated. Please save your tracking ID:"
                : "Your application has been received. Please save your tracking ID:"}
            </p>
            <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg">
              <code className="text-2xl font-mono font-bold text-primary">
                {submittedTrackingId}
              </code>
              <Button variant="ghost" size="icon" onClick={copyTrackingId}>
                <Copy className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Use this ID to track your application status.
            </p>
            {uploadedDocuments.length > 0 && (
              <div className="text-left mx-auto max-w-md space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Uploaded Documents</p>
                <ul className="space-y-1">
                  {uploadedDocuments.map((doc) => (
                    <li key={`${doc.type}-${doc.name}`} className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {DOCUMENT_LABELS[doc.type]}:{" "}
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {doc.name}
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={resetForm} className="mt-4">
              Submit Another Application
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isApplicant && (
        <Card>
          <CardHeader className="bg-muted/50 py-3">
            <CardTitle className="text-base font-medium">Update Incomplete Application</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              If your application was marked incomplete, select it to update and resubmit.
            </p>
            <Select
              value={selectedExistingId}
              onValueChange={setSelectedExistingId}
              disabled={loadingExisting || existingApplications.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingExisting ? "Loading applications..." : "Select incomplete application"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {existingApplications.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.tracking_id} - {app.applicant_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedExistingId && (
              <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm">
                You are updating an incomplete application. Submitting will resubmit it for review.
              </div>
            )}
            {selectedExistingId && existingDocuments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Existing Attachments</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {existingDocuments.map((doc) => (
                    <li key={doc.id}>
                      {doc.file_url ? (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {doc.file_name}
                        </a>
                      ) : (
                        doc.file_name
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Applicant Information */}
          <Card>
            <CardHeader className="bg-muted/50 py-3">
              <CardTitle className="text-base font-medium">Applicant Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <FormField
                control={form.control}
                name="applicant_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name of the Person Submitting the Application<span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation of the Person<span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number<span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="03XXXXXXXXX" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">(Enter Phone Number without Dash, e.g. 03XXXXXXXXX)</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="applicant_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address<span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cnic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNIC of the Applicant<span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="XXXXX-XXXXXXX-X" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Unit Information */}
          <Card>
            <CardHeader className="bg-muted/50 py-3">
              <CardTitle className="text-base font-medium">Unit Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="unit_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit ID<span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Format: ***-***-***" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">(Format: ***-***-***)</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name of Unit<span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="industry_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address of the Industry<span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="epa_action_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Action by EPA<span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Industry Information */}
          <Card>
            <CardHeader className="bg-muted/50 py-3">
              <CardTitle className="text-base font-medium">Industry Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="industry_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry Category<span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("industry_subcategory", "");
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="- Select -" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="industry_subcategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry Subcategory<span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!selectedCategory || availableSubcategories.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="- Select -" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableSubcategories.map((subcategory) => (
                            <SelectItem key={subcategory.id} value={subcategory.name}>
                              {subcategory.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District<span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="- Select -" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DISTRICTS.map((district) => (
                            <SelectItem key={district} value={district}>
                              {district}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Detail of Actions */}
          <Card>
            <CardHeader className="bg-muted/50 py-3">
              <CardTitle className="text-base font-medium">Detail of Actions<span className="text-destructive">*</span></CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <FormField
                control={form.control}
                name="actions"
                render={() => (
                  <FormItem>
                    <div className="grid gap-3 md:grid-cols-2">
                      {EPA_ACTIONS.map((action) => (
                        <FormField
                          key={action}
                          control={form.control}
                          name="actions"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(action)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, action])
                                      : field.onChange(
                                          field.value?.filter((val) => val !== action)
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal cursor-pointer">
                                {action}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Supporting Documents */}
          <Card>
            <CardHeader className="bg-muted/50 py-3">
              <CardTitle className="text-base font-medium">Supporting Document</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-3">
                {/* Application Document */}
                <div className="space-y-3">
                  <Button
                    type="button"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => window.open(SAMPLE_DOCUMENTS.application.url, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {SAMPLE_DOCUMENTS.application.label}
                  </Button>
                  <div>
                    <FormLabel>Upload Application for Compliance of Standards<span className="text-destructive">*</span></FormLabel>
                    {documents.application.file ? (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate flex-1">{documents.application.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeDocument("application")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        ref={applicationInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileSelect(e, "application")}
                        className="mt-2"
                      />
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      onClick={() => toast.info("PDF format only, max 10MB")}
                    >
                      <Info className="h-3 w-3" />
                      Upload requirements
                    </button>
                  </div>
                </div>

                {/* Affidavit Document */}
                <div className="space-y-3">
                  <Button
                    type="button"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => window.open(SAMPLE_DOCUMENTS.affidavit.url, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {SAMPLE_DOCUMENTS.affidavit.label}
                  </Button>
                  <div>
                    <FormLabel>Upload Affidavit<span className="text-destructive">*</span></FormLabel>
                    {documents.affidavit.file ? (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate flex-1">{documents.affidavit.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeDocument("affidavit")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        ref={affidavitInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileSelect(e, "affidavit")}
                        className="mt-2"
                      />
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      onClick={() => toast.info("PDF format only, max 10MB")}
                    >
                      <Info className="h-3 w-3" />
                      Upload requirements
                    </button>
                  </div>
                </div>

                {/* Undertaking Document */}
                <div className="space-y-3">
                  <Button
                    type="button"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => window.open(SAMPLE_DOCUMENTS.undertaking.url, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {SAMPLE_DOCUMENTS.undertaking.label}
                  </Button>
                  <div>
                    <FormLabel>Upload Undertaking</FormLabel>
                    {documents.undertaking.file ? (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate flex-1">{documents.undertaking.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeDocument("undertaking")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        ref={undertakingInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileSelect(e, "undertaking")}
                        className="mt-2"
                      />
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                      onClick={() => toast.info("PDF format only, max 10MB")}
                    >
                      <Info className="h-3 w-3" />
                      Upload requirements
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit
          </Button>
        </form>
      </Form>
    </div>
  );
}
