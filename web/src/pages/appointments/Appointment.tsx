import { useEffect, useRef, useState } from "react";
import { Alert, Container, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { useAppt } from "../../contexts/AppointmentContext";
import { fetchDoctorById } from "../../api/doctor";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step4 from "./steps/Step4";

function positiveId(value: string | null): number | null {
  if (!value?.trim()) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const STEPS = [
  { step: 1, title: "Bác sĩ & Chuyên khoa" },
  { step: 2, title: "Ngày & Ca khám" },
  { step: 3, title: "Hồ sơ bệnh nhân" },
  { step: 4, title: "Xác nhận & Đặt hẹn" },
] as const;

export default function Appointment() {
  const { state, dispatch } = useAppt();
  const [sp, setSp] = useSearchParams();
  const doctorIdParam = sp.get("doctorId");
  const specialtyIdParam = sp.get("specialtyId");
  const stepParam = sp.get("step");
  const [loadingDoctor, setLoadingDoctor] = useState(Boolean(positiveId(doctorIdParam)));
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const previousStep = useRef<{ url: string | null; state: number } | null>(null);

  const currentSelection = useRef(state);

  useEffect(() => {
    currentSelection.current = state;
  }, [state]);

  // URL navigation and step buttons must not overwrite each other during initialization.
  useEffect(() => {
    const previous = previousStep.current;
    previousStep.current = { url: stepParam, state: state.step };
    const value = Number(stepParam || 1);
    const urlStep = value === 2 || value === 3 || value === 4 ? value : 1;

    if (!previous || previous.url !== stepParam) {
      if (state.step !== urlStep) dispatch({ type: "SET_STEP", step: urlStep });
      if (stepParam !== null && stepParam !== String(urlStep)) {
        const next = new URLSearchParams(sp);
        next.set("step", String(urlStep));
        setSp(next, { replace: true });
      }
    } else if (previous.state !== state.step && urlStep !== state.step) {
      const next = new URLSearchParams(sp);
      next.set("step", String(state.step));
      setSp(next, { replace: true });
    }
  }, [stepParam, state.step, sp, setSp, dispatch]);

  // Prefill only when the selection in the URL changes, not when a step changes.
  useEffect(() => {
    let active = true;
    const doctorId = positiveId(doctorIdParam);
    const specialtyId = positiveId(specialtyIdParam);
    setDoctorError(null);

    if (!doctorId) {
      setLoadingDoctor(false);
      if (doctorIdParam !== null || (specialtyIdParam !== null && !specialtyId)) {
        dispatch({ type: "SET_SPECIALTY", id: specialtyId });
        dispatch({ type: "SET_STEP", step: 1 });
        setDoctorError(doctorIdParam !== null
          ? "Mã bác sĩ không hợp lệ. Vui lòng chọn lại bác sĩ."
          : "Mã chuyên khoa không hợp lệ. Vui lòng chọn lại chuyên khoa.");
      } else if (specialtyId && currentSelection.current.specialtyId !== specialtyId) {
        dispatch({ type: "SET_SPECIALTY", id: specialtyId });
      }
      return;
    }

    setLoadingDoctor(true);
    fetchDoctorById(doctorId)
      .then((doctor) => {
        if (!active) return;
        // The doctor's actual specialty takes precedence over a conflicting URL parameter.
        const resolvedSpecialtyId = positiveId(String(doctor.specialtyId ?? "")) ?? specialtyId;
        if (doctor.id !== doctorId || !resolvedSpecialtyId || !doctor.fullName) {
          throw new Error("Doctor details are incomplete");
        }
        // Refreshing the same booking must preserve its date, shift and patients.
        const saved = currentSelection.current;
        if (saved.doctorId === doctor.id && saved.specialtyId === resolvedSpecialtyId && saved.doctorFullName) {
          return;
        }
        dispatch({
          type: "SET_SPECIALTY_AND_DOCTOR",
          specialtyId: resolvedSpecialtyId,
          specialtyName: doctor.specialtyName,
          doctorId: doctor.id,
          doctorFullName: doctor.fullName,
          doctorDegree: doctor.degree,
          doctorExperience: doctor.experience,
          doctorAvatarUrl: doctor.avatarUrl,
          doctorDescription: doctor.description,
        });
      })
      .catch(() => {
        if (!active) return;
        dispatch({ type: "SET_SPECIALTY", id: specialtyId });
        dispatch({ type: "SET_STEP", step: 1 });
        setDoctorError("Không thể tải thông tin bác sĩ. Vui lòng chọn lại bác sĩ ở bước 1.");
      })
      .finally(() => {
        if (active) setLoadingDoctor(false);
      });

    return () => {
      active = false;
    };
  }, [doctorIdParam, specialtyIdParam, dispatch]);

  const currentStep = Math.min(Math.max(state.step || 1, 1), 4);
  const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <Container className="appt-wrap py-4">
      {/* Animated Modern Stepper */}
      <div className="appt-stepper-container">
        <div className="appt-stepper-track-wrap">
          <div className="appt-stepper-line-bg" />
          <div
            className="appt-stepper-line-progress"
            style={{ width: `${progressPercent}%` }}
          />
          <div className="appt-stepper-items">
            {STEPS.map((s) => {
              const isActive = state.step === s.step;
              const isCompleted = state.step > s.step;
              const isClickable = s.step < state.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  className={`appt-stepper-step ${isActive ? "is-active" : ""} ${
                    isCompleted ? "is-completed" : ""
                  } ${isClickable ? "is-clickable" : ""}`}
                  onClick={() => {
                    if (isClickable) {
                      dispatch({ type: "SET_STEP", step: s.step });
                    }
                  }}
                  disabled={!isClickable && !isActive}
                  title={isClickable ? `Quay lại: ${s.title}` : undefined}
                >
                  <div className="appt-stepper-circle">
                    {isCompleted ? (
                      <span className="appt-stepper-check">✓</span>
                    ) : (
                      <span>{s.step}</span>
                    )}
                  </div>
                  <span className="appt-stepper-label">{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {doctorError && <Alert variant="danger">{doctorError}</Alert>}
      {loadingDoctor ? (
        <div className="d-flex align-items-center gap-2 py-4" role="status">
          <Spinner size="sm" /> Đang tải thông tin bác sĩ…
        </div>
      ) : (
        <div key={state.step} className="appt-step-view">
          {state.step === 1 && <Step1 />}
          {state.step === 2 && <Step2 />}
          {state.step === 3 && <Step3 />}
          {state.step === 4 && <Step4 />}
        </div>
      )}
    </Container>
  );
}
