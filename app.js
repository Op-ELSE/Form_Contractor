// ==========================================================================
// APP LOGIC - ABB SURVEY PLATFORM (SURVEY ONLY MODE FOR POWER AUTOMATE)
// ==========================================================================

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

// Collects all wizard data, commits it to localStorage database and triggers download
function saveFullSurvey() {
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
    
    // Save to local storage list just for browser session history
    surveys.push(newSurvey);
    localStorage.setItem("abb_surveys", JSON.stringify(surveys));
    
    // Show success view
    showStep(4);
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
