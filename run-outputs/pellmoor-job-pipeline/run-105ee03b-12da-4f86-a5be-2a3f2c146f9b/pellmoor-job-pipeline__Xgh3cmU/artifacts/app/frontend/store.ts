export class Store {
  private currentVacancy: any = null;
  private vacancies: any[] = [];

  setToken(token: string) {
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  clearToken() {
    localStorage.removeItem('auth_token');
  }

  setVacancies(vacancies: any[]) {
    this.vacancies = vacancies;
  }

  getVacancies() {
    return this.vacancies;
  }

  setCurrentVacancy(vacancy: any) {
    this.currentVacancy = vacancy;
  }

  getCurrentVacancy() {
    return this.currentVacancy;
  }

  setTheme(theme: 'light' | 'dark') {
    localStorage.setItem('theme', theme);
  }

  getTheme(): 'light' | 'dark' {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  }

  // Batch offer tracking
  setBatchOperation(roleCode: string, operation: any) {
    sessionStorage.setItem(`batch_${roleCode}`, JSON.stringify(operation));
  }

  getBatchOperation(roleCode: string) {
    const data = sessionStorage.getItem(`batch_${roleCode}`);
    return data ? JSON.parse(data) : null;
  }

  clearBatchOperation(roleCode: string) {
    sessionStorage.removeItem(`batch_${roleCode}`);
  }
}
