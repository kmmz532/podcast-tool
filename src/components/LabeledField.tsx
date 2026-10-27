import { Box, TextField, Typography, type TextFieldProps } from '@mui/material';
import { pevenFont } from 'pevenmui';

/**
 * 見出しを上に置いた入力欄。PevenMUI のテーマでは MUI の浮かぶラベルが入力と重なるため利用しない。
 * 読み上げ用の名前は aria-label で付ける
 */
export function LabeledField({ label, slotProps, ...rest }: Omit<TextFieldProps, 'label'> & { label: string }) {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography component="div" sx={{ fontSize: pevenFont('sm'), color: 'text.secondary', mb: 0.25 }}>
        {label}
      </Typography>
      <TextField size="small" fullWidth {...rest} slotProps={{ ...slotProps, htmlInput: { 'aria-label': label, ...(slotProps?.htmlInput as object) } }} />
    </Box>
  );
}
