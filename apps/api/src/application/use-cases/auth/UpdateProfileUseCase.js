import { UnauthorizedError, ValidationError } from "../../../domain/errors/AuthErrors.js";
import { mapUserResponse } from "../../dtos/mapUserResponse.js";
import { isValidPkContact, normalizeContact } from "./utils.js";

export class UpdateProfileUseCase {
  constructor({ userRepository, auditLogger, publicBaseUrl }) {
    this.userRepository = userRepository;
    this.auditLogger = auditLogger;
    this.publicBaseUrl = publicBaseUrl;
  }

  async execute({ userId, first_name, last_name, designation, contact_number, email, cnic, request }) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("Unauthorized");
    }

    if (cnic !== undefined && cnic !== user.cnic) {
      throw new ValidationError("CNIC cannot be updated.");
    }

    const updates = {};
    if (first_name !== undefined) {
      updates.first_name = first_name ? String(first_name).trim() : null;
    }
    if (last_name !== undefined) {
      updates.last_name = last_name ? String(last_name).trim() : null;
    }
    if (designation !== undefined) {
      updates.designation = designation ? String(designation).trim() : null;
    }
    if (contact_number !== undefined) {
      if (!isValidPkContact(contact_number)) {
        throw new ValidationError("Contact number must be a valid Pakistani mobile number.");
      }
      const normalizedContact = normalizeContact(contact_number);
      updates.contact_number = normalizedContact || null;
    }

    if (email !== undefined) {
      const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
      if (normalizedEmail && normalizedEmail !== user.email) {
        const existing = await this.userRepository.findByEmail(normalizedEmail);
        if (existing && existing.id !== user.id) {
          throw new ValidationError("Email already in use.");
        }
      }
      if (normalizedEmail !== user.email) {
        updates.email = normalizedEmail;
        updates.email_verified = false;
        updates.email_verified_at = null;
      }
    }

    const nextFirstName = updates.first_name !== undefined ? updates.first_name : user.first_name;
    const nextLastName = updates.last_name !== undefined ? updates.last_name : user.last_name;
    const fullName = [nextFirstName, nextLastName].filter(Boolean).join(" ").trim();
    updates.full_name = fullName || user.full_name || null;
    updates.updated_by = user.id;

    const updatedUser = await this.userRepository.updateUser(user.id, updates);

    await this.auditLogger.log({
      action: "user.profile_updated",
      entityType: "user",
      entityId: user.id,
      user: updatedUser,
      req: request,
    });

    return {
      status: 200,
      body: { user: mapUserResponse(updatedUser, this.publicBaseUrl) },
    };
  }
}
