pub mod tools;
pub mod playbooks;
pub mod profiles;
pub mod evidence;
pub mod ai;
pub mod system;
pub mod benchmark;
mod ollama_commands;

use tauri::Manager;

pub fn register_commands() -> Vec<tauri::ipc::Command> {
    vec![
        tools::get_tools(),
        tools::install_tool(),
        tools::list_tools(),
        tools::search_tools(),
        playbooks::get_playbooks(),
        playbooks::run_playbook(),
        playbooks::list_playbooks(),
        playbooks::get_playbook_detail(),
        profiles::get_profiles(),
        profiles::list_profiles(),
        profiles::create_profile(),
        profiles::delete_profile(),
        profiles::engage_profile(),
        profiles::disengage_profile(),
        profiles::get_opsec_status(),
        evidence::list_evidence(),
        evidence::verify_evidence(),
        evidence::export_evidence_manifest(),
        ai::triage_findings(),
        ai::check_ollama_status(),
        ollama_commands::ollama_triage_findings(),
        ollama_commands::ollama_summarize_report(),
        ollama_commands::ollama_suggest_mitre(),
        ollama_commands::ollama_save_settings(),
        ollama_commands::ollama_get_settings(),
        system::get_secwin_path(),
        system::run_secwin_command(),
        system::get_system_info(),
        system::get_settings(),
        system::get_ollama_models(),
        benchmark::run_benchmark(),
        benchmark::list_benchmarks(),
        benchmark::load_benchmark_result(),
        benchmark::compare_benchmarks(),
        benchmark::run_install_benchmark(),
        benchmark::run_playbook_benchmark(),
        benchmark::run_tool_benchmark(),
        benchmark::benchmark_secwin(),
        benchmark::get_benchmark_results(),
    ]
}