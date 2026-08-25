// ==========================================================================
// APP LOGIC - ABB SURVEY PLATFORM (GITHUB ISSUES AS DATABASE)
// ==========================================================================

// *** CONFIGURACIÓN GITHUB ISSUES (BASE DE DATOS GRATUITA / SIN PREMIUM) ***
// 1. Crea un Personal Access Token (Classic o Fine-Grained) en GitHub con permisos de 'issues' (read & write).
// 2. Coloca aquí tu usuario/organización, el nombre del repositorio y el Token:
const GITHUB_CONFIG = {
const GITHUB_CONFIG = {
    owner: "op-else",                    // ✅ Ya configurado
    repo: "Form_Contractor",             // ✅ Ya configurado
    token: "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",        // Token: ghp_... o github_pat_...
    labels: ["encuesta", "satisfaccion-servicio"]
};

// Global state variables
let surveys = [];
let currentStep = 1;
let supervisorsList = []; // List of supervisor names added in step 1
let currentSupervisorIndex = 0; // Pointer to current supervisor being evaluated
let supervisorEvaluations = []; // Temporary storage for supervisor evaluations in progress

// Initialize application on load
window.addEventListener("DOMContentLoaded", () => {
    // Load from local storage if exists (just to keep local session history)
    const stored = localStorage.getItem("abb_surveys");
    if (stored) {
        surveys = JSON.parse(stored);
    }
    
    // Set default date in Form
    document.getElementById("input-fecha").valueAsDate = new Date();
});

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
        // Clear planification inputs
        clearRadioGroup("q_planificacion");
        document.getElementById("comm_q_planificacion").value = "";
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
        
        if (supervisorsList.length === 0) {
            alert("Por favor, seleccione al menos un supervisor.");
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
    
    // Configure buttons
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
    
    // Clear or pre-fill supervisor form values if they were already recorded
    const existing = supervisorEvaluations[currentSupervisorIndex];
    if (existing) {
        setRadioVal("qs_equipos", existing.equipos);
        document.getElementById("comm_qs_equipos").value = existing.equiposComentario;
        
        setRadioVal("qs_epp", existing.epp);
        document.getElementById("comm_qs_epp").value = existing.eppComentario;
        
        setRadioVal("qs_resolver", existing.resolver);
        document.getElementById("comm_qs_resolver").value = existing.resolverComentario;
        
        setRadioVal("qs_documental", existing.documental);
        document.getElementById("comm_qs_documental").value = existing.documentalComentario;
        
        setRadioVal("qs_actitud", existing.actitud);
        document.getElementById("comm_qs_actitud").value = existing.actitudComentario;
        
        setRadioVal("qs_puntualidad", existing.puntualidad);
        document.getElementById("comm_qs_puntualidad").value = existing.puntualidadComentario;
        
        setRadioVal("qs_comunicacion", existing.comunicacion);
        document.getElementById("comm_qs_comunicacion").value = existing.comunicacionComentario;
        
        setRadioVal("qs_conocimiento", existing.conocimiento);
        document.getElementById("comm_qs_conocimiento").value = existing.conocimientoComentario;
    } else {
        // Clear all inputs and comment fields
        clearRadioGroup("qs_equipos");
        document.getElementById("comm_qs_equipos").value = "";
        
        clearRadioGroup("qs_epp");
        document.getElementById("comm_qs_epp").value = "";
        
        clearRadioGroup("qs_resolver");
        document.getElementById("comm_qs_resolver").value = "";
        
        clearRadioGroup("qs_documental");
        document.getElementById("comm_qs_documental").value = "";
        
        clearRadioGroup("qs_actitud");
        document.getElementById("comm_qs_actitud").value = "";
        
        clearRadioGroup("qs_puntualidad");
        document.getElementById("comm_qs_puntualidad").value = "";
        
        clearRadioGroup("qs_comunicacion");
        document.getElementById("comm_qs_comunicacion").value = "";
        
        clearRadioGroup("qs_conocimiento");
        document.getElementById("comm_qs_conocimiento").value = "";
    }
}

// Submits the evaluation for the current supervisor and advances
function submitSupervisorEval() {
    // Record current evaluations with individual comments
    const evalData = {
        supervisorName: supervisorsList[currentSupervisorIndex],
        
        // HSE Aspect
        equipos: getRadioVal("qs_equipos"),
        equiposComentario: document.getElementById("comm_qs_equipos").value.trim(),
        
        epp: getRadioVal("qs_epp"),
        eppComentario: document.getElementById("comm_qs_epp").value.trim(),
        
        resolver: getRadioVal("qs_resolver"),
        resolverComentario: document.getElementById("comm_qs_resolver").value.trim(),
        
        documental: getRadioVal("qs_documental"),
        documentalComentario: document.getElementById("comm_qs_documental").value.trim(),
        
        // Social Aspect
        actitud: getRadioVal("qs_actitud"),
        actitudComentario: document.getElementById("comm_qs_actitud").value.trim(),
        
        puntualidad: getRadioVal("qs_puntualidad"),
        puntualidadComentario: document.getElementById("comm_qs_puntualidad").value.trim(),
        
        // Technical Aspect
        comunicacion: getRadioVal("qs_comunicacion"),
        comunicacionComentario: document.getElementById("comm_qs_comunicacion").value.trim(),
        
        conocimiento: getRadioVal("qs_conocimiento"),
        conocimientoComentario: document.getElementById("comm_qs_conocimiento").value.trim()
    };
    
    // Save to temp array
    supervisorEvaluations[currentSupervisorIndex] = evalData;
    
    if (currentSupervisorIndex < supervisorsList.length - 1) {
        // Move to next supervisor
        currentSupervisorIndex++;
        setupSupervisorEvaluationStep();
        // Scroll to top of the card
        document.querySelector(".survey-card").scrollIntoView({ behavior: 'smooth' });
    } else {
        // All supervisors evaluated, advance to Step 3 (Planificación)
        showStep(3);
        // Scroll to top of the card
        document.querySelector(".survey-card").scrollIntoView({ behavior: 'smooth' });
    }
}

// Format Issue body with both human-readable Markdown and structured JSON
function formatIssueBody(surveyData) {
    const jsonString = JSON.stringify(surveyData, null, 2);

    let supervisorsSummary = surveyData.evaluacionesSupervisores.map(sup => {
        return `#### 👤 Supervisor: **${sup.supervisorName}**
- **HSE**:
  - Equipos / Herramientas: **${sup.equipos}** ${sup.equiposComentario ? `(_${sup.equiposComentario}_)` : ""}
  - Uniforme y EPPs: **${sup.epp}** ${sup.eppComentario ? `(_${sup.eppComentario}_)` : ""}
  - Capaz de resolver consultas: **${sup.resolver}** ${sup.resolverComentario ? `(_${sup.resolverComentario}_)` : ""}
  - Llenado de seguridad: **${sup.documental}** ${sup.documentalComentario ? `(_${sup.documentalComentario}_)` : ""}
- **Social**:
  - Actitud adecuada: **${sup.actitud}** ${sup.actitudComentario ? `(_${sup.actitudComentario}_)` : ""}
  - Puntualidad: **${sup.puntualidad}** ${sup.puntualidadComentario ? `(_${sup.puntualidadComentario}_)` : ""}
- **Técnico**:
  - Transmitir información clara: **${sup.comunicacion}** ${sup.comunicacionComentario ? `(_${sup.comunicacionComentario}_)` : ""}
  - Conocimiento de la actividad: **${sup.conocimiento}** ${sup.conocimientoComentario ? `(_${sup.conocimientoComentario}_)` : ""}
`;
    }).join("\n");

    return `## 📋 Encuesta de Satisfacción del Servicio ABB

| Parámetro | Detalle |
| :--- | :--- |
| **ID de Registro** | \`${surveyData.id}\` |
| **Cliente** | ${surveyData.cliente} |
| **Nombre del Servicio** | ${surveyData.servicio} |
| **Contratista** | ${surveyData.contratista} |
| **Fecha de Intervención** | ${surveyData.fecha} |
| **Planificación e Interacción ABB** | **${surveyData.planificacionABB} / 5** ${surveyData.planificacionABBComentario ? `(_${surveyData.planificacionABBComentario}_)` : ""} |

---

### 👷 Evaluaciones por Supervisor
${supervisorsSummary}

---

### 📦 Datos Estructurados JSON (Power Automate / Power BI)
\`\`\`json
${jsonString}
\`\`\`
`;
}

// Collects all wizard data, sends via GitHub REST API to create an Issue
async function saveFullSurvey() {
    const selectContratista = document.getElementById("input-contratista").value;
    const contratistaVal = selectContratista === "OTRO"
        ? document.getElementById("input-contratista-otro").value.trim()
        : selectContratista;

    const newSurvey = {
        id: "survey_" + Date.now(),
        cliente: document.getElementById("input-cliente").value.trim(),
        servicio: document.getElementById("input-servicio").value.trim(),
        contratista: contratistaVal,
        fecha: document.getElementById("input-fecha").value,

        // Planificación y Programación (Interacción ABB)
        planificacionABB: getRadioVal("q_planificacion"),
        planificacionABBComentario: document.getElementById("comm_q_planificacion").value.trim(),

        evaluacionesSupervisores: supervisorEvaluations
    };

    // Save to local storage as backup
    surveys.push(newSurvey);
    localStorage.setItem("abb_surveys", JSON.stringify(surveys));

    // --- Show loading state on submit button ---
    const submitBtn = document.querySelector("#form-planificacion-eval button[type='submit']");
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" class="spin-icon">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4
                     M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        Guardando en GitHub...`;

    // --- POST a GitHub Issues API ---
    try {
        if (!GITHUB_CONFIG.token || GITHUB_CONFIG.token === "TU_GITHUB_PAT_TOKEN") {
            throw new Error("Token de GitHub no configurado en app.js (GITHUB_CONFIG.token).");
        }
        if (!GITHUB_CONFIG.owner || GITHUB_CONFIG.owner === "TU_USUARIO_O_ORGANIZACION") {
            throw new Error("Usuario/Organización de GitHub no configurado en app.js.");
        }

        const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/issues`;
        
        const payload = {
            title: `[Encuesta] ${newSurvey.cliente} - ${newSurvey.servicio} (${newSurvey.fecha})`,
            body: formatIssueBody(newSurvey),
            labels: GITHUB_CONFIG.labels
        };

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Accept": "application/vnd.github+json",
                "Authorization": `Bearer ${GITHUB_CONFIG.token}`,
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Error de GitHub (${response.status}): ${errorData.message || response.statusText}`);
        }

        const issueData = await response.json();
        console.log("Issue creado con éxito en GitHub:", issueData.html_url);

        // Update success view link if container exists
        const issueLinkEl = document.getElementById("success-issue-link");
        if (issueLinkEl) {
            issueLinkEl.innerHTML = `<a href="${issueData.html_url}" target="_blank" style="color:var(--abb-red); text-decoration:underline;">Ver Issue #${issueData.number} en GitHub ↗</a>`;
        }

        // Success: show success step
        showStep(4);

    } catch (err) {
        console.error("Error al registrar en GitHub Issues:", err);
        // Restore button and show error message
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        showSendError(err.message);
    }
}

// Shows an inline error banner below the Finalizar button
function showSendError(message) {
    // Remove any previous error
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
    
    // Go to first step
    showStep(1);
}

// Helper functions for radio inputs
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
