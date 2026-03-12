package models

import (
	"reflect"
	"strings"
	"testing"
)

// getGORMTag はフィールドのgormタグ文字列を返す。フィールドが存在しない場合は空文字列を返す。
func getGORMTag(t *testing.T, structType reflect.Type, fieldName string) string {
	t.Helper()
	field, ok := structType.FieldByName(fieldName)
	if !ok {
		t.Errorf("フィールド %q が存在しません", fieldName)
		return ""
	}
	return field.Tag.Get("gorm")
}

func TestPushSubscriptionFields(t *testing.T) {
	typ := reflect.TypeOf(PushSubscription{})

	tests := []struct {
		field       string
		wantContain string
	}{
		{"ID", "primaryKey"},
		{"UserID", "not null"},
		{"UserID", "index"},
		{"Endpoint", "uniqueIndex"},
		{"P256DH", "varchar(255)"},
		{"Auth", "varchar(255)"},
		{"UserAgent", "varchar(500)"},
	}

	for _, tt := range tests {
		tag := getGORMTag(t, typ, tt.field)
		if !strings.Contains(tag, tt.wantContain) {
			t.Errorf("PushSubscription.%s のgormタグ %q に %q が含まれていません", tt.field, tag, tt.wantContain)
		}
	}

	// CreatedAt フィールドが存在するか確認
	if _, ok := typ.FieldByName("CreatedAt"); !ok {
		t.Error("PushSubscription に CreatedAt フィールドが存在しません")
	}
}

func TestNotificationSettingsDefaults(t *testing.T) {
	typ := reflect.TypeOf(NotificationSettings{})

	tests := []struct {
		field        string
		wantContain  string
		description  string
	}{
		{"UserID", "primaryKey", "UserID は primaryKey"},
		{"PushEnabled", "default:true", "PushEnabled のデフォルトは true"},
		{"EmailEnabled", "default:true", "EmailEnabled のデフォルトは true"},
		{"DailySuggestion", "default:true", "DailySuggestion のデフォルトは true"},
		{"WeeklySummary", "default:true", "WeeklySummary のデフォルトは true"},
		{"MonthlySummary", "default:false", "MonthlySummary のデフォルトは false（opt-in）"},
		{"StreakReminder", "default:true", "StreakReminder のデフォルトは true"},
		{"UpdatedAt", "autoUpdateTime", "UpdatedAt は autoUpdateTime"},
	}

	for _, tt := range tests {
		tag := getGORMTag(t, typ, tt.field)
		if !strings.Contains(tag, tt.wantContain) {
			t.Errorf("%s: gormタグ %q に %q が含まれていません", tt.description, tag, tt.wantContain)
		}
	}
}
