import { AppShell, FLOW_CARD_SHADOW, FlowButton, FlowTopbar, ImportStepper, PageFrame } from '@miceplans/ui';

const A = '/assets/import';

export default function ImportDonePage() {
  return (
    <AppShell active="events">
      <PageFrame topbar={<FlowTopbar showToggle breadcrumb={['행사s', 'Excel Import']} />} mainClassName="items-center">
        <div className="flex h-[527px] w-[760px] shrink-0 flex-col items-center justify-between">
          <div className="flex w-[760px] flex-col items-start gap-[6px] py-[36px] whitespace-nowrap">
            <h1 className="m-0 text-xl font-bold text-fg">Excel에서 행사s 가져오기</h1>
            <p className="m-0 text-md text-fg-secondary">기존 스프레드시트의 행사 데이터를 MICEPLANS으로 가져옵니다</p>
          </div>
          <ImportStepper current={5} />
          <div className="flex flex-col items-center gap-[20px]">
            <div className={`flex h-[313px] w-[760px] flex-col items-center rounded-lg bg-surface px-[24px] py-[44px] ${FLOW_CARD_SHADOW}`}>
              <div className="flex w-[515px] flex-col items-center">
                <div className="flex flex-col items-center">
                  <div className="flex size-[64px] items-center justify-center rounded-full bg-success-bg">
                    <img alt="" src={`${A}/success-icon.svg`} className="size-[30px]" />
                  </div>
                  <div className="flex flex-col items-center gap-[6px] py-[16px] whitespace-nowrap">
                    <p className="m-0 text-xl font-bold text-fg">가져오기 완료</p>
                    <p className="m-0 text-base text-fg-secondary">1,248행 처리 완료 · 2025.03.06 오후 2:31</p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-[6px] bg-surface-subtle p-[12px] text-xs whitespace-nowrap">
                  <p className="m-0 font-semibold text-fg">유의 사항</p>
                  <div className="flex flex-col items-start gap-[6px] text-fg-secondary">
                    <p className="m-0">· 342행: 상태 값 ‘보류중’을(를) 인식할 수 없음</p>
                    <p className="m-0">· 891행: 장소 값이 비어 있음</p>
                  </div>
                </div>
              </div>
            </div>
            <FlowButton variant="primary" href="/">
              행사 보기
            </FlowButton>
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}
