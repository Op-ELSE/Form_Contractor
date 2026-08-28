// *** CONFIGURACIÓN DE ENVÍO CON GOOGLE APPS SCRIPT (GMAIL) ***
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzc8ZHkqa-vFCR0h_HroDngp0B5qf_irYQakBnnC-c0TE0gglIL36CAXZG-Ub2Tx8yw/exec";

// Global state variables
let surveys = [];
let currentStep = 1;
let supervisorsList = []; // List of supervisor names added in step 1
let currentSupervisorIndex = 0; // Pointer to current supervisor being evaluated
let supervisorEvaluations = []; // Temporary storage for supervisor evaluations in progress
let expectedOS = ""; // Expected OS from URL query param

// Question definition list for supervisor evaluation step
const SUPERVISOR_QUESTIONS = [
    { name: "qs_equipos", label: "2.1 Equipos y Herramientas" },
    { name: "qs_epp", label: "2.2 EPPs y Uniforme" },
    { name: "qs_resolver", label: "2.3 Consultas / Resolución" },
    { name: "qs_documental", label: "2.4 Documentos de Seguridad" },
    { name: "qs_actitud", label: "2.5 Actitud" },
    { name: "qs_puntualidad", label: "2.6 Puntualidad" },
    { name: "qs_comunicacion", label: "2.7 Comunicación" },
    { name: "qs_conocimiento", label: "2.8 Conocimiento Técnico" }
];

// ==========================================================================
// INITIALIZATION
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
    // Load from local storage if exists
    const stored = localStorage.getItem("abb_surveys");
    if (stored) {
        try {
            surveys = JSON.parse(stored);
        } catch (e) {
            surveys = [];
        }
    }
    
    // Default date in Form
    document.getElementById("input-fecha").valueAsDate = new Date();

    // 1. Load URL query parameters and setup Lock Screen
    loadQueryParams();

    // 2. Setup real-time comment validation for scores <= 3
    setupRealtimeCommentValidation();
});

// ==========================================================================
// 1. PRE-LLENADO AUTOMÁTICO VÍA QUERY PARAMETERS
// ==========================================================================
function loadQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Read OS parameter (supports os, OS, orden, ot)
    expectedOS = urlParams.get("os") || urlParams.get("OS") || urlParams.get("orden") || urlParams.get("ot") || "";

    // Read other form parameters
    const clienteParam = urlParams.get("cliente") || urlParams.get("Cliente") || "";
    const servicioParam = urlParams.get("servicio") || urlParams.get("Servicio") || "";
    const contratistaParam = urlParams.get("contratista") || urlParams.get("Contratista") || "";
    const fechaParam = urlParams.get("fecha") || urlParams.get("Fecha") || "";
    const supervisorParam = urlParams.get("supervisor") || urlParams.get("supervisores") || urlParams.get("Supervisor") || "";

    if (clienteParam) {
        document.getElementById("input-cliente").value = clienteParam;
    }
    if (servicioParam) {
        document.getElementById("input-servicio").value = servicioParam;
    }
    if (fechaParam) {
        document.getElementById("input-fecha").value = fechaParam;
    }
    if (contratistaParam) {
        const select = document.getElementById("input-contratista");
        let found = false;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value.toUpperCase() === contratistaParam.trim().toUpperCase()) {
                select.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (!found && contratistaParam.trim()) {
            select.value = "OTRO";
            toggleContratistaOtro();
            document.getElementById("input-contratista-otro").value = contratistaParam.trim();
        }
    }
    if (supervisorParam) {
        const supList = supervisorParam.split(",").map(s => s.trim().toLowerCase());
        const checkboxes = document.querySelectorAll('input[name="check-supervisors"]');
        checkboxes.forEach(cb => {
            const val = cb.value.toLowerCase();
            if (supList.some(s => val.includes(s) || s.includes(val))) {
                cb.checked = true;
            }
        });
    }

    // Configure lock screen modal
    setupLockScreen();
}

// ==========================================================================
// 2. PANTALLA DE BLOQUEO DINÁMICO POR CÓDIGO (OS)
// ==========================================================================
function normalizeCode(val) {
    if (!val) return "";
    return String(val)
        .trim()
        .toUpperCase()
        .replace(/^(OS|OT|ORDEN)[\s\-_/:]*/i, "")
        .replace(/[\s\-_/:]+/g, "");
}

function setupLockScreen() {
    const lockScreen = document.getElementById("lock-screen");
    const formLock = document.getElementById("form-lock");
    const invalidBanner = document.getElementById("lock-invalid-link");
    const lockInput = document.getElementById("lock-input-code");
    
    if (!expectedOS || !expectedOS.trim()) {
        // Enlace inválido: no contiene parámetro OS
        formLock.style.display = "none";
        invalidBanner.style.display = "flex";
    } else {
        formLock.style.display = "block";
        invalidBanner.style.display = "none";
        setTimeout(() => lockInput.focus(), 150);
    }
}

function handleUnlock() {
    const lockInput = document.getElementById("lock-input-code");
    const lockError = document.getElementById("lock-error-msg");
    const lockCard = document.getElementById("lock-card");
    const lockScreen = document.getElementById("lock-screen");
    const val = lockInput.value;

    if (!expectedOS || !expectedOS.trim()) {
        lockError.textContent = "⚠️ Enlace inválido. No se ha proporcionado una Orden de Servicio.";
        lockError.style.display = "flex";
        return;
    }

    if (normalizeCode(val) === normalizeCode(expectedOS)) {
        // Código correcto: desbloquear
        lockError.style.display = "none";
        document.getElementById("input-os").value = expectedOS;
        lockScreen.classList.add("unlocked");
    } else {
        // Código incorrecto: sacudir y mostrar error
        lockError.textContent = "❌ Código de acceso incorrecto. Verifique su Orden de Servicio.";
        lockError.style.display = "flex";
        lockCard.classList.add("shake");
        setTimeout(() => lockCard.classList.remove("shake"), 500);
        lockInput.focus();
        lockInput.select();
    }
}

// ==========================================================================
// 3. COMENTARIO OBLIGATORIO CUANDO EL PUNTAJE SEA <= 3 (TIEMPO REAL)
// ==========================================================================
function setupRealtimeCommentValidation() {
    // Escuchar cambios en cualquier radio button de calificación
    document.addEventListener("change", (e) => {
        if (e.target && e.target.type === "radio" && (e.target.name.startsWith("qs_") || e.target.name === "q_planificacion")) {
            handleRatingChange(e.target);
        }
    });

    // Escuchar cuando el usuario escribe en un input de comentario para remover error visual
    document.addEventListener("input", (e) => {
        if (e.target && e.target.classList.contains("question-comment-input")) {
            handleCommentInput(e.target);
        }
    });
}

function handleRatingChange(radioEl) {
    const questionName = radioEl.name;
    const val = radioEl.value;
    const commentInput = document.getElementById(`comm_${questionName}`);
    if (!commentInput) return;

    const parentCard = document.getElementById(`card_${questionName}`) || commentInput.closest(".question-card");
    let warningMsg = parentCard ? parentCard.querySelector(".comment-warning-msg") : null;

    if (val === "1" || val === "2" || val === "3") {
        // Marcar comentario como obligatorio en tiempo real
        commentInput.classList.add("comment-required");
        commentInput.placeholder = "❗ Comentario obligatorio para puntaje ≤ 3";
        
        if (!warningMsg && parentCard) {
            warningMsg = document.createElement("div");
            warningMsg.className = "comment-warning-msg";
            warningMsg.innerHTML = "⚠️ Debes justificar este puntaje con un comentario";
            commentInput.after(warningMsg);
        } else if (warningMsg) {
            warningMsg.style.display = "flex";
        }
    } else {
        // Calificación 4, 5 o NA -> comentario opcional
        commentInput.classList.remove("comment-required", "field-error");
        commentInput.placeholder = "Comentario sobre esta respuesta";
        if (warningMsg) {
            warningMsg.remove();
        }
        if (parentCard) {
            parentCard.classList.remove("field-error");
            const badge = parentCard.querySelector(".error-badge");
            if (badge) badge.remove();
        }
    }
}

function handleCommentInput(commentEl) {
    const parentCard = commentEl.closest(".question-card");
    if (commentEl.value.trim().length > 0) {
        commentEl.classList.remove("field-error");
        if (parentCard) {
            parentCard.classList.remove("field-error");
            const badge = parentCard.querySelector(".error-badge");
            if (badge) badge.remove();
        }
    }
}

// ==========================================================================
// CONTRATISTA DYNAMIC TOGGLE
// ==========================================================================
function toggleContratistaOtro() {
    const select = document.getElementById("input-contratista");
    const groupOtro = document.getElementById("group-contratista-otro");
    const inputOtro = document.getElementById("input-contratista-otro");
    if (select.value === "OTRO") {
        groupOtro.style.display = "flex";
        inputOtro.required = true;
        inputOtro.focus();
    } else {
        groupOtro.style.display = "none";
        inputOtro.required = false;
        inputOtro.value = "";
    }
}

// ==========================================================================
// WIZARD STEP NAVIGATION & FORM CONTROL
// ==========================================================================
function showStep(stepNum) {
    // Hide all steps
    document.querySelectorAll(".survey-step").forEach(step => step.classList.remove("active-step"));
    
    // Reset wizard dots
    document.querySelectorAll(".step-dot").forEach((dot, idx) => {
        dot.classList.toggle("active", idx + 1 === stepNum);
        dot.classList.toggle("completed", idx + 1 < stepNum);
    });
    
    // Update progress bar
    const progressPercent = ((stepNum - 1) / 3) * 100 + 25;
    document.getElementById("survey-progress").style.width = `${progressPercent}%`;
    
    // Show target step
    if (stepNum === 1) {
        document.getElementById("step-general").classList.add("active-step");
    } else if (stepNum === 2) {
        document.getElementById("step-supervisors-eval").classList.add("active-step");
        setupSupervisorEvaluationStep();
    } else if (stepNum === 3) {
        document.getElementById("step-planificacion-eval").classList.add("active-step");
        clearRadioGroup("q_planificacion");
        document.getElementById("comm_q_planificacion").value = "";
        const commPlan = document.getElementById("comm_q_planificacion");
        commPlan.classList.remove("comment-required", "field-error");
        commPlan.placeholder = "Comentario sobre esta respuesta";
        const warning = document.querySelector("#step-planificacion-eval .comment-warning-msg");
        if (warning) warning.remove();
    } else if (stepNum === 4) {
        document.getElementById("step-success").classList.add("active-step");
        document.getElementById("survey-progress").style.width = "100%";
        document.getElementById("dot-4").classList.add("completed");
    }
    
    currentStep = stepNum;
}

function nextStep() {
    if (currentStep === 1) {
        // Collect checked supervisors
        supervisorsList = [];
        const checkboxes = document.querySelectorAll('input[name="check-supervisors"]:checked');
        checkboxes.forEach(cb => {
            supervisorsList.push(cb.value);
        });
        
        const supSection = document.getElementById("supervisors-selection-section");
        if (supervisorsList.length === 0) {
            if (supSection) {
                supSection.classList.add("shake");
                setTimeout(() => supSection.classList.remove("shake"), 500);
            }
            alert("❗ Por favor, seleccione al menos un supervisor para evaluar.");
            return;
        }
        
        currentSupervisorIndex = 0;
        supervisorEvaluations = [];
        showStep(2);
    }
}

function prevStep() {
    if (currentStep === 2) {
        if (currentSupervisorIndex > 0) {
            // Go to previous supervisor
            currentSupervisorIndex--;
            setupSupervisorEvaluationStep();
        } else {
            // Go to general info step
            showStep(1);
        }
    } else if (currentStep === 3) {
        // Go back to evaluating the last supervisor
        currentSupervisorIndex = supervisorsList.length - 1;
        showStep(2);
    }
}

// Set up the form fields in step 2 for the current supervisor
function setupSupervisorEvaluationStep() {
    const supervisorName = supervisorsList[currentSupervisorIndex];
    
    // Set headers
    document.getElementById("eval-supervisor-title").textContent = `2. Evaluación de Supervisor (${currentSupervisorIndex + 1}/${supervisorsList.length})`;
    document.getElementById("eval-supervisor-name").textContent = supervisorName;
    
    // Configure button text
    const submitBtn = document.getElementById("btn-submit-supervisor");
    if (currentSupervisorIndex === supervisorsList.length - 1) {
        submitBtn.innerHTML = `
            Siguiente (Planificación)
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        `;
    } else {
        submitBtn.innerHTML = `
            Siguiente Supervisor
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        `;
    }

    // Clean any previous error badges and warning states
    document.querySelectorAll("#step-supervisors-eval .error-badge").forEach(b => b.remove());
    document.querySelectorAll("#step-supervisors-eval .comment-warning-msg").forEach(m => m.remove());
    document.querySelectorAll("#step-supervisors-eval .field-error").forEach(el => el.classList.remove("field-error"));
    document.querySelectorAll("#step-supervisors-eval .comment-required").forEach(el => el.classList.remove("comment-required"));
    
    // Clear or pre-fill supervisor form values
    const existing = supervisorEvaluations[currentSupervisorIndex];
    SUPERVISOR_QUESTIONS.forEach(q => {
        const commentInput = document.getElementById(`comm_${q.name}`);
        commentInput.placeholder = "Comentario sobre esta respuesta";
        
        if (existing && existing[q.name]) {
            setRadioVal(q.name, existing[q.name]);
            commentInput.value = existing[`${q.name}Comentario`] || "";
            
            // Re-apply required warning if score <= 3
            if (existing[q.name] === "1" || existing[q.name] === "2" || existing[q.name] === "3") {
                commentInput.classList.add("comment-required");
                commentInput.placeholder = "❗ Comentario obligatorio para puntaje ≤ 3";
                const warningMsg = document.createElement("div");
                warningMsg.className = "comment-warning-msg";
                warningMsg.innerHTML = "⚠️ Debes justificar este puntaje con un comentario";
                commentInput.after(warningMsg);
            }
        } else {
            clearRadioGroup(q.name);
            commentInput.value = "";
        }
    });
}

// ==========================================================================
// 5. VALIDACIÓN VISUAL CON ÍCONO DE EXCLAMACIÓN (❗) AL AVANZAR
// ==========================================================================
function validateSupervisorStep() {
    let isValid = true;
    let firstErrorElement = null;

    // Clear previous error badges and error classes
    document.querySelectorAll("#step-supervisors-eval .error-badge").forEach(b => b.remove());
    document.querySelectorAll("#step-supervisors-eval .field-error").forEach(el => el.classList.remove("field-error"));

    SUPERVISOR_QUESTIONS.forEach(q => {
        const val = getRadioVal(q.name);
        const card = document.getElementById(`card_${q.name}`);
        const commentInput = document.getElementById(`comm_${q.name}`);
        const commentVal = commentInput ? commentInput.value.trim() : "";

        if (!val) {
            isValid = false;
            if (card) {
                card.classList.add("field-error", "shake");
                setTimeout(() => card.classList.remove("shake"), 500);
                const title = card.querySelector(".question-title");
                const badge = document.createElement("div");
                badge.className = "error-badge";
                badge.innerHTML = "❗ Campo obligatorio: Seleccione una calificación";
                title.after(badge);
                if (!firstErrorElement) firstErrorElement = card;
            }
        } else if ((val === "1" || val === "2" || val === "3") && !commentVal) {
            isValid = false;
            if (card) {
                card.classList.add("field-error", "shake");
                setTimeout(() => card.classList.remove("shake"), 500);
                if (commentInput) commentInput.classList.add("field-error");
                const title = card.querySelector(".question-title");
                const badge = document.createElement("div");
                badge.className = "error-badge";
                badge.innerHTML = "❗ Comentario obligatorio: Justifique la calificación ≤ 3";
                title.after(badge);
                if (!firstErrorElement) firstErrorElement = card;
            }
        }
    });

    if (!isValid && firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return isValid;
}

function submitSupervisorEval() {
    // Validar preguntas y comentarios obligatorios
    if (!validateSupervisorStep()) {
        return;
    }

    // Guardar evaluación del supervisor actual
    const evalData = {
        supervisorName: supervisorsList[currentSupervisorIndex] || null,
        
        // HSE Aspect
        equipos: getRadioVal("qs_equipos") || null,
        equiposComentario: document.getElementById("comm_qs_equipos").value.trim() || null,
        
        epp: getRadioVal("qs_epp") || null,
        eppComentario: document.getElementById("comm_qs_epp").value.trim() || null,
        
        resolver: getRadioVal("qs_resolver") || null,
        resolverComentario: document.getElementById("comm_qs_resolver").value.trim() || null,
        
        documental: getRadioVal("qs_documental") || null,
        documentalComentario: document.getElementById("comm_qs_documental").value.trim() || null,
        
        // Social Aspect
        actitud: getRadioVal("qs_actitud") || null,
        actitudComentario: document.getElementById("comm_qs_actitud").value.trim() || null,
        
        puntualidad: getRadioVal("qs_puntualidad") || null,
        puntualidadComentario: document.getElementById("comm_qs_puntualidad").value.trim() || null,
        
        // Technical Aspect
        comunicacion: getRadioVal("qs_comunicacion") || null,
        comunicacionComentario: document.getElementById("comm_qs_comunicacion").value.trim() || null,
        
        conocimiento: getRadioVal("qs_conocimiento") || null,
        conocimientoComentario: document.getElementById("comm_qs_conocimiento").value.trim() || null
    };
    
    supervisorEvaluations[currentSupervisorIndex] = evalData;
    
    if (currentSupervisorIndex < supervisorsList.length - 1) {
        // Siguiente supervisor
        currentSupervisorIndex++;
        setupSupervisorEvaluationStep();
        document.querySelector(".survey-card").scrollIntoView({ behavior: "smooth" });
    } else {
        // Avanzar al Paso 3 (Planificación)
        showStep(3);
        document.querySelector(".survey-card").scrollIntoView({ behavior: "smooth" });
    }
}

function validatePlanificacionStep() {
    const val = getRadioVal("q_planificacion");
    const card = document.getElementById("card_q_planificacion");
    const commentInput = document.getElementById("comm_q_planificacion");
    const commentVal = commentInput ? commentInput.value.trim() : "";

    document.querySelectorAll("#step-planificacion-eval .error-badge").forEach(b => b.remove());
    document.querySelectorAll("#step-planificacion-eval .field-error").forEach(el => el.classList.remove("field-error"));

    if (!val) {
        if (card) {
            card.classList.add("field-error", "shake");
            setTimeout(() => card.classList.remove("shake"), 500);
            const title = card.querySelector(".question-title");
            const badge = document.createElement("div");
            badge.className = "error-badge";
            badge.innerHTML = "❗ Campo obligatorio: Seleccione una calificación";
            title.after(badge);
            card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return false;
    }

    if ((val === "1" || val === "2" || val === "3") && !commentVal) {
        if (card) {
            card.classList.add("field-error", "shake");
            setTimeout(() => card.classList.remove("shake"), 500);
            if (commentInput) commentInput.classList.add("field-error");
            const title = card.querySelector(".question-title");
            const badge = document.createElement("div");
            badge.className = "error-badge";
            badge.innerHTML = "❗ Comentario obligatorio: Justifique la calificación ≤ 3";
            title.after(badge);
            card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return false;
    }

    return true;
}

// ==========================================================================
// 7. ESTRUCTURA JSON COMPLETA Y ENVÍO A GOOGLE APPS SCRIPT
// ==========================================================================
async function saveFullSurvey() {
    // Validar paso de planificación
    if (!validatePlanificacionStep()) {
        return;
    }

    const selectContratista = document.getElementById("input-contratista").value;
    const contratistaVal = selectContratista === "OTRO"
        ? document.getElementById("input-contratista-otro").value.trim()
        : selectContratista;

    const osVal = document.getElementById("input-os") ? document.getElementById("input-os").value.trim() : expectedOS;

    // Estructura JSON completa y consistente (propiedades explícitas o null)
    const newSurvey = {
        id: "survey_" + Date.now(),
        os: osVal || null,
        cliente: document.getElementById("input-cliente").value.trim() || null,
        servicio: document.getElementById("input-servicio").value.trim() || null,
        contratista: contratistaVal || null,
        fecha: document.getElementById("input-fecha").value || null,

        // Planificación y Programación (Interacción ABB)
        planificacionABB: getRadioVal("q_planificacion") || null,
        planificacionABBComentario: document.getElementById("comm_q_planificacion").value.trim() || null,

        // Evaluaciones completas de supervisores
        evaluacionesSupervisores: supervisorEvaluations.map(s => ({
            supervisorName: s.supervisorName || null,
            equipos: s.equipos || null,
            equiposComentario: s.equiposComentario || null,
            epp: s.epp || null,
            eppComentario: s.eppComentario || null,
            resolver: s.resolver || null,
            resolverComentario: s.resolverComentario || null,
            documental: s.documental || null,
            documentalComentario: s.documentalComentario || null,
            actitud: s.actitud || null,
            actitudComentario: s.actitudComentario || null,
            puntualidad: s.puntualidad || null,
            puntualidadComentario: s.puntualidadComentario || null,
            comunicacion: s.comunicacion || null,
            comunicacionComentario: s.comunicacionComentario || null,
            conocimiento: s.conocimiento || null,
            conocimientoComentario: s.conocimientoComentario || null
        }))
    };

    // Guardar en localStorage como respaldo local
    surveys.push(newSurvey);
    try {
        localStorage.setItem("abb_surveys", JSON.stringify(surveys));
    } catch (e) {
        console.warn("No se pudo guardar en localStorage:", e);
    }

    // Estado visual de envío en el botón
    const submitBtn = document.querySelector("#form-planificacion-eval button[type='submit']");
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" class="spin-icon">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4
                     M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Enviando Encuesta...`;

    // Envío directo a Google Apps Script
    try {
        const payload = {
            "ID_Encuesta": newSurvey.id,
            "OS": newSurvey.os,
            "Cliente": newSurvey.cliente,
            "Nombre_Servicio": newSurvey.servicio,
            "Contratista": newSurvey.contratista,
            "Fecha_Intervencion": newSurvey.fecha,
            "Interaccion_ABB_Nota": newSurvey.planificacionABB,
            "Interaccion_ABB_Comentario": newSurvey.planificacionABBComentario || "Sin comentario",
            "Resumen_Supervisores": newSurvey.evaluacionesSupervisores.map(s => 
                `[${s.supervisorName}] HSE: Equipos=${s.equipos}, EPP=${s.epp}, Resol=${s.resolver}, Doc=${s.documental} | Social: Actitud=${s.actitud}, Puntual=${s.puntualidad} | Técnico: Comunic=${s.comunicacion}, Conoc=${s.conocimiento}`
            ).join(" ; "),
            "RAW_JSON": JSON.stringify(newSurvey, null, 2),
            "evaluacionesSupervisores": newSurvey.evaluacionesSupervisores,
            "survey": newSurvey
        };

        await submitToGoogleScript(payload);

        // Éxito: mostrar paso 4
        showStep(4);

    } catch (err) {
        console.error("Error al enviar la encuesta a Google:", err);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        showSendError("No se pudo conectar con el servicio de Google. Verifique su conexión.");
    }
}

// Envío a Google Apps Script Web App
async function submitToGoogleScript(data) {
    return fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(data)
    });
}

// Muestra banner de error si la conexión falla
function showSendError(message) {
    const prev = document.getElementById("send-error-banner");
    if (prev) prev.remove();

    const banner = document.createElement("div");
    banner.id = "send-error-banner";
    banner.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${message}</span>`;
    banner.style.cssText = `
        display:flex; align-items:center; gap:8px;
        background:#fff0f0; border:1.5px solid #FF000F; border-radius:8px;
        color:#cc0000; font-size:0.875rem; padding:10px 14px;
        margin-top:12px;`;

    const actions = document.querySelector("#form-planificacion-eval .step-actions");
    actions.after(banner);
}

function resetSurvey() {
    // Clear forms
    document.getElementById("form-general").reset();
    document.getElementById("form-supervisor-eval").reset();
    document.getElementById("form-planificacion-eval").reset();
    
    // Reset date
    document.getElementById("input-fecha").valueAsDate = new Date();
    
    // Reset supervisors checklist
    const checkboxes = document.querySelectorAll('input[name="check-supervisors"]');
    checkboxes.forEach(cb => cb.checked = false);

    // Reset contractor selectors
    toggleContratistaOtro();
    
    // Reset pointers
    supervisorsList = [];
    currentSupervisorIndex = 0;
    supervisorEvaluations = [];
    
    // Re-load parameters if any
    loadQueryParams();

    // Go to first step
    showStep(1);
}

// ==========================================================================
// RADIO INPUT HELPERS
// ==========================================================================
function getRadioVal(name) {
    const radios = document.getElementsByName(name);
    for (let r of radios) {
        if (r.checked) return r.value;
    }
    return "";
}

function setRadioVal(name, value) {
    const radios = document.getElementsByName(name);
    for (let r of radios) {
        r.checked = (r.value === value);
    }
}

function clearRadioGroup(name) {
    const radios = document.getElementsByName(name);
    for (let r of radios) {
        r.checked = false;
    }
}
