CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  open_id VARCHAR(191) NOT NULL UNIQUE,
  created_at VARCHAR(32) NOT NULL,
  last_login_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS analyses (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  upstream_analysis_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  original_file_name VARCHAR(255) NULL,
  video_meta_json LONGTEXT NULL,
  report_id VARCHAR(64) NULL,
  error_code VARCHAR(64) NULL,
  error_message VARCHAR(255) NULL,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_analyses_upstream_analysis_id (upstream_analysis_id),
  KEY idx_analyses_user_created_at (user_id, created_at),
  KEY idx_analyses_report_id (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  analysis_id VARCHAR(64) NOT NULL,
  upstream_analysis_id VARCHAR(128) NOT NULL,
  report_no VARCHAR(128) NULL,
  generated_at VARCHAR(32) NULL,
  result_json LONGTEXT NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_reports_analysis_id (analysis_id),
  KEY idx_reports_user_generated_at (user_id, generated_at),
  KEY idx_reports_report_no (report_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
