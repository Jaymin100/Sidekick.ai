from enum import Enum

class Intent(str, Enum):
    NAVIGATION = "navigation"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    UPLOAD = "upload"
    DOWNLOAD = "download"
    AUTHENTICATION = "authentication"
    TROUBLESHOOTING = "troubleshooting"
    INFORMATION_LOOKUP = "information_lookup"
    UNKNOWN = "unknown"
    