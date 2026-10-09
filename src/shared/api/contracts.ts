// Correspondência aos records Java em dto/request e dto/response.
// UUID, LocalDate, Instant e LocalDateTime chegam como strings JSON.
export type UUID = string
export type LocalDate = string
export type Instant = string
export type LocalDateTime = string

export interface LoginRequestDTO {
  username: string
  password: string
}

export interface LoginResponseDTO {
  token: string
  name: string
  role: string
  passwordChanged: boolean
}

export interface ForgotPasswordRequestDTO { username: string }
export interface ResetPasswordRequestDTO { token: string; newPassword: string }
export interface ChangePasswordRequestDTO { currentPassword: string; newPassword: string }

// Necessário para POST /api/auth/register, existente e restrito a ADMIN.
export interface RegisterRequestDTO {
  name: string
  username: string
  contactEmail: string | null
  password: string
}

export interface UserResponseDTO {
  id: UUID
  name: string
  username: string
  contactEmail: string | null
  role: string
  active: boolean
  passwordChanged: boolean
}

export interface CategoryRequestDTO { name: string; active: boolean }
export interface CategoryResponseDTO { id: UUID; name: string; active: boolean }

export interface ReportRequestDTO {
  categoryId: UUID
  description: string
  incidentDate: LocalDate | null
  incidentLocation: string | null
}

export interface ProtocolResponseDTO { protocol: string }

export interface ReportResponseDTO {
  protocol: string
  category: string
  description: string
  incidentDate: LocalDate | null
  incidentLocation: string | null
  createdAt: Instant
  closedAt: Instant | null
  messagesPurgedAt: Instant | null
}

export interface ReportAdminSummaryResponseDTO {
  protocol: string
  category: string
  description: string
  createdAt: Instant
  closedAt: Instant | null
  ownerName: string
  ownerUsername: string
}

export interface ReportAdminResponseDTO extends ReportResponseDTO {
  ownerName: string
  ownerUsername: string
  ownerContactEmail: string | null
  attachments: AttachmentResponseDTO[]
}

export interface ReportMessageRequestDTO { body: string }

export interface ReportMessageResponseDTO {
  id: UUID
  authorName: string
  authorUsername: string
  authorRole: string
  body: string
  createdAt: Instant
}

export interface AttachmentResponseDTO {
  id: UUID
  originalFileName: string
  contentType: string
  fileSize: number | null
  createdAt: LocalDateTime
}

export interface ErrorResponseDTO {
  status: number
  erro: string
  timestamp: LocalDateTime
}

export interface ValidationErrorResponseDTO {
  status: number
  detalhes: Record<string, string>
  timestamp: LocalDateTime
}
