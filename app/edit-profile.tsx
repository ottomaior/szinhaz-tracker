import { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { inputFontSize } from "@/theme/type";
import { gutter, radius, space } from "@/theme/tokens";
import { bodyFont } from "@/theme/typography";
import { useAppFonts } from "@/hooks/useAppFonts";
import { useAuth } from "@/contexts/AuthContext";
import {
  BIO_MAX_LENGTH,
  HANDLE_PATTERN,
  HandleTakenError,
  avatarUrl,
  getMyProfileDraft,
  updateProfile,
  uploadAvatar,
} from "@/services/profileService";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { ContentColumn } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { strings } from "@/i18n/hu";
import { closeModal } from "@/utils/navigation";
import { profileInitials } from "@/utils/people";
import { makeStyles } from "@/theme/styles";

/**
 * The one screen where a profile stops being read-only.
 *
 * Everything on it is optional except the name, which is what the initials
 * fallback and every byline are drawn from. `initials` itself is deliberately
 * not a field: 0027 derives it from the name in a trigger, so offering it here
 * would only let the two disagree.
 */
export default function EditProfileScreen() {
  const styles = useStyles();

  const router = useRouter();
  const fontsLoaded = useAppFonts();
  const { session, loading } = useAuth();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  // The picked image is uploaded the moment it is chosen, exactly as add-play
  // does it: the preview then shows a file that really exists, and saving is
  // one small row update rather than a save button that waits on a photograph.
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string>();
  const [uploading, setUploading] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!session) return;
    let active = true;
    getMyProfileDraft()
      .then((draft) => {
        if (!active) return;
        setName(draft.name);
        setHandle(draft.handle);
        setCity(draft.city);
        setBio(draft.bio);
        setAvatarPath(draft.avatarPath);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [session]);

  async function handlePickPhoto() {
    if (uploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(strings.editProfile.errorPhotoPermission);
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      // Square, unlike the poster picker: this image is only ever shown inside
      // a circle, so cropping it once here beats cropping it in every avatar.
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    setLocalPreview(asset.uri);
    setError(undefined);
    setUploading(true);
    try {
      setAvatarPath(await uploadAvatar(asset.uri));
    } catch {
      // Drop the preview too — leaving it up would imply the image was saved.
      setLocalPreview(undefined);
      setError(strings.editProfile.errorPhotoUpload);
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePhoto() {
    setLocalPreview(undefined);
    setAvatarPath(null);
  }

  async function handleSave() {
    if (saving || uploading) return;
    if (!name.trim()) {
      setError(strings.editProfile.errorNameRequired);
      return;
    }
    // Lower-cased for them rather than refused: "KovacsBence" is a slip of
    // the shift key, not a different intention.
    const cleanHandle = handle.trim().toLowerCase();
    if (!HANDLE_PATTERN.test(cleanHandle)) {
      setError(strings.editProfile.errorHandleShape);
      return;
    }
    if (bio.trim().length > BIO_MAX_LENGTH) {
      setError(strings.editProfile.errorBioTooLong);
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      await updateProfile({ name, handle: cleanHandle, city, bio, avatarPath });
      closeModal(router, "/(tabs)/profile");
    } catch (e) {
      setError(e instanceof HandleTakenError ? strings.editProfile.errorHandleTaken : strings.auth.genericError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ModalHeader title={strings.editProfile.title} fallbackRoute="/(tabs)/profile" />
        <ContentColumn style={{ padding: gutter, gap: space.lg }}>
          <Text variant="body" tone="dim">{strings.profile.signInPrompt}</Text>
          <Button label={strings.profile.signInButton} onPress={() => router.replace("/sign-in")} />
        </ContentColumn>
      </View>
    );
  }

  // The preview prefers the local file: it is on screen before the upload has
  // finished, and once it has, both point at the same picture anyway.
  const previewUri = localPreview ?? (avatarPath ? avatarUrl(avatarPath) : undefined);
  const hasPhoto = !!previewUri;
  const bioLeft = BIO_MAX_LENGTH - bio.trim().length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={strings.editProfile.title} fallbackRoute="/(tabs)/profile" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: space["5xl"] }}
        keyboardShouldPersistTaps="handled"
      >
        <ContentColumn style={{ padding: gutter, gap: space.xl }}>
          <View style={{ gap: space.sm }}>
            <Text variant="label" tone="dim">{strings.editProfile.photoLabel}</Text>
            <View style={styles.photoRow}>
              {/* The same component the rest of the app draws, so what the form
                  shows is exactly what a feed card will show. */}
              <Avatar uri={previewUri} initials={profileInitials(name)} size={72} serif />
              <View style={{ gap: space.sm, flexShrink: 1 }}>
                <Pressable
                  onPress={handlePickPhoto}
                  disabled={uploading}
                  accessibilityRole="button"
                  style={styles.photoButton}
                >
                  <Text variant="label">
                    {uploading
                      ? strings.editProfile.photoUploading
                      : hasPhoto
                        ? strings.editProfile.photoReplace
                        : strings.editProfile.photoAdd}
                  </Text>
                </Pressable>
                {hasPhoto && !uploading && (
                  <Pressable onPress={handleRemovePhoto} hitSlop={8} accessibilityRole="button">
                    <Text variant="label" tone="dim">{strings.editProfile.photoRemove}</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Text variant="caption" tone="dim">{strings.editProfile.photoHint}</Text>
          </View>

          <Field
            label={strings.editProfile.nameLabel}
            value={name}
            onChangeText={setName}
            placeholder={strings.editProfile.namePlaceholder}
            fontsLoaded={fontsLoaded}
          />

          <View style={{ gap: space.sm }}>
            <Field
              label={strings.editProfile.handleLabel}
              value={handle}
              onChangeText={setHandle}
              placeholder={strings.editProfile.handlePlaceholder}
              fontsLoaded={fontsLoaded}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text variant="caption" tone="dim">{strings.editProfile.handleHint}</Text>
          </View>

          <Field
            label={strings.editProfile.cityLabel}
            value={city}
            onChangeText={setCity}
            placeholder={strings.editProfile.cityPlaceholder}
            fontsLoaded={fontsLoaded}
          />

          <View style={{ gap: space.sm }}>
            <View style={styles.bioLabelRow}>
              <Text variant="label" tone="dim">{strings.editProfile.bioLabel}</Text>
              {/* Only once it is worth knowing about. A counter sitting at 280
                  from the first keystroke is chrome; one that appears as the
                  room runs out is information. */}
              {bioLeft <= 60 && (
                <Text variant="caption" tone={bioLeft < 0 ? "accent" : "faint"}>
                  {bioLeft < 0
                    ? strings.editProfile.bioOver(-bioLeft)
                    : strings.editProfile.bioRemaining(bioLeft)}
                </Text>
              )}
            </View>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={strings.editProfile.bioPlaceholder}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel={strings.editProfile.bioLabel}
              multiline
              // Deliberately no `maxLength`: silently swallowing keystrokes
              // reads as a broken keyboard. The counter and the check in
              // `handleSave` say what is wrong instead.
              style={[styles.input, styles.bioInput, { fontFamily: bodyFont(fontsLoaded) }]}
            />
          </View>

          {!!error && (
            <Text accessibilityRole="alert" variant="bodySmall" tone="accent">
              {error}
            </Text>
          )}

          <Button
            label={saving ? strings.editProfile.saving : strings.editProfile.save}
            disabled={saving || uploading || !loaded}
            onPress={handleSave}
          />
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  fontsLoaded,
  autoCapitalize,
  autoCorrect,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  fontsLoaded: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
}) {
  const styles = useStyles();

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="dim">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={[styles.input, { fontFamily: bodyFont(fontsLoaded) }]}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  photoRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  photoButton: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bioLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: 14,
    fontSize: inputFontSize,
    color: colors.text,
  },
  bioInput: { minHeight: 108, textAlignVertical: "top" },
}));
