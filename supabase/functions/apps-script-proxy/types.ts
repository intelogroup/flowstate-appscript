
export interface FlowConfig {
  senders?: string
  emailFilter?: string
  driveFolder: string
  fileTypes?: string[]
  userId?: string
  flowName?: string
  maxEmails?: number
  enableDebugMode?: boolean
}

export interface RequestBody {
  action: string
  flowId?: string
  userConfig?: FlowConfig
  user_id?: string
}

export interface AppsScriptPayload {
  auth_token: string
  action: string
  userEmail: string | null
  userConfig: {
    senders?: string
    driveFolder: string
    fileTypes?: string[]
    flowName: string
    maxEmails: number
    enableDebugMode: boolean
  }
  debug_info: {
    request_id: string
    has_user_email: boolean
    auth_method: string
    timestamp: string
  }
}
