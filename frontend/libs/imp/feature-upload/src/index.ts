/**
 * Public API barrel for @cordele/imp/feature-upload.
 * Exports the smart UploadComponent and all presentational sub-components (P4).
 */
export { UploadComponent } from './lib/upload/upload.component';

// Presentational components (FE-IMP-012..015)
export { ProjectNameFieldComponent } from './lib/project-name-field/project-name-field.component';
export { ManuscriptDropZoneComponent } from './lib/manuscript-drop-zone/manuscript-drop-zone.component';
export { UploadProgressCardComponent } from './lib/upload-progress-card/upload-progress-card.component';
export { ImportSubmitButtonComponent } from './lib/import-submit-button/import-submit-button.component';

// StepBar stub (P4 only — replaced by imp-navigation/StepBarComponent in P5)
export { StepBarComponent } from './lib/step-bar/step-bar.component';
