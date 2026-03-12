package templates

import "embed"

// EmailFS はメールテンプレートの埋め込みファイルシステム
//
//go:embed email/*.html
var EmailFS embed.FS
